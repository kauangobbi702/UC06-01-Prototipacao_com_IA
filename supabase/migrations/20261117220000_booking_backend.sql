-- Booking backend for PostgreSQL 15 / Supabase.
-- Apply this migration to a Supabase project whose Auth schema is enabled.

-- btree_gist supplies GiST equality support for UUIDs so active bookings can
-- enforce a per-teacher time-range exclusion constraint.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Remove the earlier ownerless prototype table's anonymous write surface.
-- The canonical, owner-scoped lesson catalog is public.aulas below.
DO $$
BEGIN
  IF to_regclass('public.lesson_types') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.lesson_types ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.lesson_types FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_lesson_types" ON public.lesson_types';
    EXECUTE 'DROP POLICY IF EXISTS "anon_insert_lesson_types" ON public.lesson_types';
    EXECUTE 'REVOKE ALL ON TABLE public.lesson_types FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

-- A profile is one-to-one with Supabase Auth. Deleting the Auth user cascades
-- the profile and all teacher-owned data; the cleanup trigger below deletes
-- appointments before lessons so the appointment-to-lesson RESTRICT remains.
CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 3 AND 120),
  slug text NOT NULL UNIQUE
    CHECK (
      char_length(slug) BETWEEN 1 AND 80
      AND slug = lower(slug)
      AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),
  antecedencia_cancelamento_horas smallint NOT NULL DEFAULT 12
    CHECK (antecedencia_cancelamento_horas BETWEEN 0 AND 72),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prices use exact decimal currency units; appointment duration is snapshotted
-- in each booking so later lesson edits cannot change an existing reservation.
CREATE TABLE IF NOT EXISTS public.aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professora_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(btrim(nome)) >= 3),
  duracao_min integer NOT NULL CHECK (duracao_min BETWEEN 15 AND 120),
  preco numeric(10,2) NOT NULL CHECK (preco > 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, professora_id)
);

-- Day-of-week follows PostgreSQL EXTRACT(DOW): Sunday=0 through Saturday=6.
-- A daily interval cannot span midnight; add separate intervals for each day.
CREATE TABLE IF NOT EXISTS public.disponibilidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professora_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL CHECK (hora_fim > hora_inicio),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professora_id, dia_semana, hora_inicio, hora_fim)
);

-- A blocked date prevents new public bookings on that local calendar date.
CREATE TABLE IF NOT EXISTS public.bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professora_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  data date NOT NULL,
  motivo text CHECK (motivo IS NULL OR char_length(motivo) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professora_id, data)
);

-- cancel_token is a high-entropy UUID used only by the student RPC endpoints.
-- aluno_email and aluno_telefone are optional individually, but at least one
-- must be present. Consent is mandatory and records the exact accepted copy.
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professora_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  aula_id uuid NOT NULL,
  aluno_nome text NOT NULL CHECK (char_length(btrim(aluno_nome)) BETWEEN 2 AND 120),
  aluno_email text,
  aluno_telefone text,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  duracao_min smallint NOT NULL CHECK (duracao_min BETWEEN 15 AND 120),
  status text NOT NULL DEFAULT 'confirmado'
    CHECK (status IN ('pendente', 'confirmado', 'concluido', 'cancelado')),
  consentimento_lgpd_em timestamptz NOT NULL,
  consentimento_versao text NOT NULL CHECK (char_length(btrim(consentimento_versao)) BETWEEN 1 AND 40),
  cancel_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agendamentos_aula_professora_fk
    FOREIGN KEY (aula_id, professora_id)
    REFERENCES public.aulas(id, professora_id)
    ON DELETE RESTRICT,
  CONSTRAINT agendamentos_fim_posterior_inicio CHECK (fim > inicio),
  CONSTRAINT agendamentos_contato_obrigatorio CHECK (
    (aluno_email IS NOT NULL AND btrim(aluno_email) <> '')
    OR (aluno_telefone IS NOT NULL AND btrim(aluno_telefone) <> '')
  ),
  CONSTRAINT agendamentos_email_formato CHECK (
    aluno_email IS NULL OR (
      char_length(aluno_email) <= 254
      AND aluno_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  CONSTRAINT agendamentos_telefone_formato CHECK (
    aluno_telefone IS NULL OR (
      char_length(aluno_telefone) <= 24
      AND
      aluno_telefone ~ '^\+?[0-9][0-9 ()-]{8,22}$'
      AND char_length(pg_catalog.regexp_replace(aluno_telefone, '[^0-9]', '', 'g')) BETWEEN 10 AND 15
    )
  ),
  CONSTRAINT agendamentos_sem_sobreposicao
    EXCLUDE USING gist (
      professora_id WITH =,
      tstzrange(inicio, fim, '[)') WITH &&
    )
    WHERE (status IN ('pendente', 'confirmado'))
);

-- Notifications store no contact details; a trusted worker resolves recipients
-- through the related appointment. Service-role workers bypass RLS by design.
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('confirmacao', 'lembrete_24h', 'cancelamento')),
  enviar_em timestamptz NOT NULL,
  enviada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Frequently used teacher, date, status, lesson, and queue lookups.
CREATE INDEX IF NOT EXISTS aulas_professora_ativa_idx
  ON public.aulas (professora_id, ativo);
CREATE INDEX IF NOT EXISTS disponibilidades_professora_dia_idx
  ON public.disponibilidades (professora_id, dia_semana, hora_inicio);
CREATE INDEX IF NOT EXISTS bloqueios_professora_data_idx
  ON public.bloqueios (professora_id, data);
CREATE INDEX IF NOT EXISTS agendamentos_professora_inicio_idx
  ON public.agendamentos (professora_id, inicio);
CREATE INDEX IF NOT EXISTS agendamentos_professora_status_idx
  ON public.agendamentos (professora_id, status);
CREATE INDEX IF NOT EXISTS agendamentos_aula_idx
  ON public.agendamentos (aula_id);
CREATE INDEX IF NOT EXISTS notificacoes_pendentes_enviar_em_idx
  ON public.notificacoes (enviar_em)
  WHERE enviada_em IS NULL;
CREATE INDEX IF NOT EXISTS notificacoes_agendamento_idx
  ON public.notificacoes (agendamento_id);

-- Keep mutable rows timestamped without recording sensitive data in logs.
CREATE OR REPLACE FUNCTION public.atualizar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_fim_agendamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_duracao integer;
BEGIN
  SELECT a.duracao_min
    INTO v_duracao
    FROM public.aulas AS a
   WHERE a.id = NEW.aula_id
     AND a.professora_id = NEW.professora_id
     AND a.ativo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aula indisponível para agendamento'
      USING ERRCODE = '23514';
  END IF;

  NEW.duracao_min := v_duracao;
  NEW.fim := NEW.inicio + pg_catalog.make_interval(mins => v_duracao);
  RETURN NEW;
END;
$$;

-- The student link and availability calculations always use São Paulo local
-- dates/times. Public slots begin at each availability's start and repeat
-- every 30 minutes; appointment length must fit completely within the window.
CREATE OR REPLACE FUNCTION public._slot_disponivel(
  p_professora_id uuid,
  p_aula_id uuid,
  p_inicio timestamptz,
  p_ignorar_agendamento_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_duracao integer;
  v_inicio_local timestamp without time zone;
  v_fim_local timestamp without time zone;
  v_dia_semana smallint;
BEGIN
  IF p_professora_id IS NULL OR p_aula_id IS NULL OR p_inicio IS NULL THEN
    RETURN false;
  END IF;

  SELECT a.duracao_min
    INTO v_duracao
    FROM public.aulas AS a
   WHERE a.id = p_aula_id
     AND a.professora_id = p_professora_id
     AND a.ativo;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_inicio <= pg_catalog.now() THEN
    RETURN false;
  END IF;

  v_inicio_local := p_inicio AT TIME ZONE 'America/Sao_Paulo';
  v_fim_local := v_inicio_local + pg_catalog.make_interval(mins => v_duracao);
  v_dia_semana := EXTRACT(dow FROM v_inicio_local)::smallint;

  IF EXISTS (
    SELECT 1
      FROM public.bloqueios AS b
     WHERE b.professora_id = p_professora_id
       AND b.data = v_inicio_local::date
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.disponibilidades AS d
     WHERE d.professora_id = p_professora_id
       AND d.dia_semana = v_dia_semana
       AND v_inicio_local::time >= d.hora_inicio
       AND v_fim_local::date = v_inicio_local::date
       AND v_fim_local::time <= d.hora_fim
       AND pg_catalog.mod(
         EXTRACT(epoch FROM (v_inicio_local::time - d.hora_inicio))::integer,
         1800
       ) = 0
  )
  AND NOT EXISTS (
    SELECT 1
      FROM public.agendamentos AS ag
     WHERE ag.professora_id = p_professora_id
       AND ag.status IN ('pendente', 'confirmado')
       AND (p_ignorar_agendamento_id IS NULL OR ag.id <> p_ignorar_agendamento_id)
       AND p_inicio < ag.fim
       AND ag.inicio < p_inicio + pg_catalog.make_interval(mins => v_duracao)
  );
END;
$$;

-- A deleted teacher's appointments must be removed before cascading deletion
-- reaches aulas; otherwise the aula FK's intentional RESTRICT would block it.
CREATE OR REPLACE FUNCTION public.limpar_dados_antes_de_excluir_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  DELETE FROM public.agendamentos WHERE professora_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.agendar_notificacoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.notificacoes
     WHERE agendamento_id = NEW.id
       AND tipo = 'lembrete_24h'
       AND enviada_em IS NULL;
  END IF;

  INSERT INTO public.notificacoes (agendamento_id, tipo, enviar_em)
  VALUES
    (NEW.id, 'confirmacao', pg_catalog.now()),
    (NEW.id, 'lembrete_24h', GREATEST(pg_catalog.now(), NEW.inicio - interval '24 hours'));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notificar_cancelamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notificacoes (agendamento_id, tipo, enviar_em)
    VALUES (NEW.id, 'cancelamento', pg_catalog.now());
  END IF;
  RETURN NEW;
END;
$$;

-- Drop/recreate triggers so the migration remains safe to re-apply in a test
-- project and so existing objects acquire the current behavior.
DROP TRIGGER IF EXISTS perfis_updated_at ON public.perfis;
CREATE TRIGGER perfis_updated_at BEFORE UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS aulas_updated_at ON public.aulas;
CREATE TRIGGER aulas_updated_at BEFORE UPDATE ON public.aulas
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS disponibilidades_updated_at ON public.disponibilidades;
CREATE TRIGGER disponibilidades_updated_at BEFORE UPDATE ON public.disponibilidades
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS bloqueios_updated_at ON public.bloqueios;
CREATE TRIGGER bloqueios_updated_at BEFORE UPDATE ON public.bloqueios
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS agendamentos_updated_at ON public.agendamentos;
CREATE TRIGGER agendamentos_updated_at BEFORE UPDATE ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS notificacoes_updated_at ON public.notificacoes;
CREATE TRIGGER notificacoes_updated_at BEFORE UPDATE ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS agendamentos_calcular_fim ON public.agendamentos;
CREATE TRIGGER agendamentos_calcular_fim
BEFORE INSERT OR UPDATE OF aula_id, professora_id, inicio ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.calcular_fim_agendamento();

DROP TRIGGER IF EXISTS perfis_limpar_dados ON public.perfis;
CREATE TRIGGER perfis_limpar_dados
BEFORE DELETE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.limpar_dados_antes_de_excluir_perfil();

DROP TRIGGER IF EXISTS agendamentos_notificacoes ON public.agendamentos;
CREATE TRIGGER agendamentos_notificacoes
AFTER INSERT OR UPDATE OF inicio ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.agendar_notificacoes();

DROP TRIGGER IF EXISTS agendamentos_notificar_cancelamento ON public.agendamentos;
CREATE TRIGGER agendamentos_notificar_cancelamento
AFTER UPDATE OF status ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.notificar_cancelamento();

-- Public profile view intentionally exposes only a teacher's public slug/name.
-- PostgreSQL 15 views use owner privileges by default; underlying table access
-- is not granted to anon, and RLS still governs direct profile queries.
CREATE OR REPLACE VIEW public.perfis_publicos
WITH (security_barrier = true)
AS
SELECT p.slug, p.nome
  FROM public.perfis AS p;

-- Public lesson projection exposes only the fields needed to book by slug.
CREATE OR REPLACE VIEW public.aulas_publicas
WITH (security_barrier = true)
AS
SELECT p.slug, a.id AS aula_id, a.nome, a.duracao_min, a.preco
  FROM public.aulas AS a
  JOIN public.perfis AS p ON p.id = a.professora_id
 WHERE a.ativo;

-- The public booking page needs the cancellation lead time to show valid actions.
CREATE OR REPLACE VIEW public.regras_agendamento_publicas
WITH (security_barrier = true)
AS
SELECT p.slug, p.antecedencia_cancelamento_horas
  FROM public.perfis AS p;

-- Public RPC: list future 30-minute starts for one public teacher, lesson, and
-- São Paulo calendar date. No appointment PII or booking IDs are returned.
CREATE OR REPLACE FUNCTION public.listar_horarios_livres(
  slug text,
  aula_id uuid,
  "data" date
)
RETURNS TABLE (inicio timestamptz, fim timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_professora_id uuid;
  v_duracao integer;
BEGIN
  IF $1 IS NULL OR char_length(btrim($1)) NOT BETWEEN 1 AND 80
     OR $2 IS NULL OR $3 IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT p.id INTO v_professora_id
    FROM public.perfis AS p
   WHERE p.slug = lower(btrim($1));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Professora ou aula não encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT a.duracao_min INTO v_duracao
    FROM public.aulas AS a
   WHERE a.id = $2
     AND a.professora_id = v_professora_id
     AND a.ativo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Professora ou aula não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF $3 < (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'A data informada já passou' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT (g.inicio_local AT TIME ZONE 'America/Sao_Paulo') AS inicio,
         (g.inicio_local + pg_catalog.make_interval(mins => v_duracao))
           AT TIME ZONE 'America/Sao_Paulo' AS fim
    FROM public.disponibilidades AS d
    CROSS JOIN LATERAL pg_catalog.generate_series(
      $3::timestamp without time zone + d.hora_inicio,
      $3::timestamp without time zone + d.hora_fim
        - pg_catalog.make_interval(mins => v_duracao),
      interval '30 minutes'
    ) AS g(inicio_local)
   WHERE d.professora_id = v_professora_id
     AND d.dia_semana = EXTRACT(dow FROM $3)::smallint
     AND NOT EXISTS (
       SELECT 1 FROM public.bloqueios AS b
        WHERE b.professora_id = v_professora_id AND b.data = $3
     )
     AND public._slot_disponivel(
       v_professora_id,
       $2,
       g.inicio_local AT TIME ZONE 'America/Sao_Paulo',
       NULL
     )
   ORDER BY g.inicio_local;
END;
$$;

-- Public RPC: validate the public teacher/lesson, accepted consent, contact,
-- availability and overlap. The returned UUID is the student's private token.
CREATE OR REPLACE FUNCTION public.criar_agendamento(
  slug text,
  aula_id uuid,
  inicio timestamptz,
  aluno_nome text,
  aluno_email text,
  aluno_telefone text,
  aceite_lgpd boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_professora_id uuid;
  v_email text;
  v_telefone text;
  v_agendamento_id uuid;
  v_cancel_token uuid;
BEGIN
  IF $1 IS NULL OR char_length(btrim($1)) NOT BETWEEN 1 AND 80
     OR $2 IS NULL OR $3 IS NULL OR $4 IS NULL
     OR char_length(btrim($4)) NOT BETWEEN 2 AND 120
     OR $7 IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Dados inválidos ou consentimento obrigatório' USING ERRCODE = '22023';
  END IF;

  v_email := nullif(lower(btrim($5)), '');
  v_telefone := nullif(btrim($6), '');
  IF v_email IS NULL AND v_telefone IS NULL THEN
    RAISE EXCEPTION 'Informe um e-mail ou telefone válido' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NOT NULL
     AND (
       char_length(v_email) > 254
       OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     ) THEN
    RAISE EXCEPTION 'Informe um e-mail ou telefone válido' USING ERRCODE = '22023';
  END IF;
  IF v_telefone IS NOT NULL
     AND (
       char_length(v_telefone) > 24
       OR v_telefone !~ '^\+?[0-9][0-9 ()-]{8,22}$'
       OR char_length(pg_catalog.regexp_replace(v_telefone, '[^0-9]', '', 'g')) NOT BETWEEN 10 AND 15
     ) THEN
    RAISE EXCEPTION 'Informe um e-mail ou telefone válido' USING ERRCODE = '22023';
  END IF;

  SELECT p.id INTO v_professora_id
    FROM public.perfis AS p
   WHERE p.slug = lower(btrim($1));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Professora ou aula não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public._slot_disponivel(v_professora_id, $2, $3, NULL) THEN
    RAISE EXCEPTION 'Horário não disponível' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.agendamentos (
      professora_id, aula_id, aluno_nome, aluno_email, aluno_telefone,
      inicio, fim, duracao_min, status,
      consentimento_lgpd_em, consentimento_versao
    )
    SELECT v_professora_id, a.id, btrim($4), v_email, v_telefone,
           $3, $3, a.duracao_min, 'confirmado',
           pg_catalog.now(), 'agendamento-v1'
      FROM public.aulas AS a
     WHERE a.id = $2
       AND a.professora_id = v_professora_id
       AND a.ativo
    RETURNING id, cancel_token INTO v_agendamento_id, v_cancel_token;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Horário não disponível' USING ERRCODE = 'P0001';
  END;

  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Professora ou aula não encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_cancel_token;
END;
$$;

-- Public RPCs accept only the unguessable cancellation token. Cancellation
-- and rescheduling use the teacher-configured lead time and local availability.
CREATE OR REPLACE FUNCTION public.cancelar_agendamento(cancel_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_agendamento public.agendamentos%ROWTYPE;
  v_antecedencia smallint;
BEGIN
  IF $1 IS NULL THEN
    RAISE EXCEPTION 'Token inválido' USING ERRCODE = '22023';
  END IF;

  SELECT ag.* INTO v_agendamento
    FROM public.agendamentos AS ag
   WHERE ag.cancel_token = $1
     AND ag.status IN ('pendente', 'confirmado');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.antecedencia_cancelamento_horas INTO v_antecedencia
    FROM public.perfis AS p WHERE p.id = v_agendamento.professora_id;
  IF pg_catalog.now() > v_agendamento.inicio - pg_catalog.make_interval(hours => v_antecedencia) THEN
    RAISE EXCEPTION 'Prazo para cancelamento encerrado' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.agendamentos SET status = 'cancelado' WHERE id = v_agendamento.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reagendar_agendamento(
  cancel_token uuid,
  novo_inicio timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_agendamento public.agendamentos%ROWTYPE;
  v_antecedencia smallint;
  v_novo_fim timestamptz;
BEGIN
  IF $1 IS NULL OR $2 IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT ag.* INTO v_agendamento
    FROM public.agendamentos AS ag
   WHERE ag.cancel_token = $1
     AND ag.status IN ('pendente', 'confirmado')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.antecedencia_cancelamento_horas INTO v_antecedencia
    FROM public.perfis AS p WHERE p.id = v_agendamento.professora_id;
  IF pg_catalog.now() > v_agendamento.inicio - pg_catalog.make_interval(hours => v_antecedencia) THEN
    RAISE EXCEPTION 'Prazo para reagendamento encerrado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public._slot_disponivel(
    v_agendamento.professora_id,
    v_agendamento.aula_id,
    $2,
    v_agendamento.id
  ) THEN
    RAISE EXCEPTION 'Novo horário não disponível' USING ERRCODE = 'P0001';
  END IF;

  v_novo_fim := $2 + pg_catalog.make_interval(mins => v_agendamento.duracao_min);
  UPDATE public.agendamentos
     SET inicio = $2, fim = v_novo_fim
   WHERE id = v_agendamento.id;
  RETURN $2;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Novo horário não disponível' USING ERRCODE = 'P0001';
END;
$$;

-- LGPD erasure deletes the appointment and cascades its notification queue.
-- The token is invalidated as part of deleting the row; no PII is logged.
CREATE OR REPLACE FUNCTION public.excluir_dados_aluno(cancel_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF $1 IS NULL THEN
    RAISE EXCEPTION 'Token inválido' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.agendamentos
   WHERE cancel_token = $1
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END;
$$;

-- LGPD access right: the bearer token can retrieve only the corresponding
-- appointment's data, without granting direct SELECT on the appointments table.
DROP FUNCTION IF EXISTS public.consultar_agendamento(uuid);
CREATE FUNCTION public.consultar_agendamento(cancel_token uuid)
RETURNS TABLE (
  aula_id uuid,
  aluno_nome text,
  aluno_email text,
  aluno_telefone text,
  aula_nome text,
  preco numeric(10,2),
  inicio timestamptz,
  fim timestamptz,
  status text,
  consentimento_lgpd_em timestamptz,
  consentimento_versao text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF $1 IS NULL THEN
    RAISE EXCEPTION 'Token inválido' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT ag.aula_id, ag.aluno_nome, ag.aluno_email, ag.aluno_telefone, a.nome, a.preco,
         ag.inicio, ag.fim, ag.status,
         ag.consentimento_lgpd_em, ag.consentimento_versao
    FROM public.agendamentos AS ag
    JOIN public.aulas AS a ON a.id = ag.aula_id
   WHERE ag.cancel_token = $1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Explicit grants start closed. Students never receive direct access to
-- agendamentos; anonymous appointment operations are exposed only as RPCs.
REVOKE ALL ON TABLE
  public.perfis,
  public.aulas,
  public.disponibilidades,
  public.bloqueios,
  public.agendamentos,
  public.notificacoes
FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE
  public.perfis,
  public.aulas,
  public.disponibilidades,
  public.bloqueios,
  public.agendamentos,
  public.notificacoes
TO service_role;

GRANT SELECT ON public.perfis_publicos TO anon, authenticated;
GRANT SELECT ON public.aulas_publicas TO anon, authenticated;
GRANT SELECT ON public.regras_agendamento_publicas TO anon, authenticated;
GRANT SELECT (id, nome, duracao_min, preco) ON public.aulas TO anon;
GRANT SELECT, INSERT, UPDATE ON public.perfis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aulas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disponibilidades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bloqueios TO authenticated;
GRANT SELECT (
  id, professora_id, aula_id, aluno_nome, aluno_email, aluno_telefone,
  inicio, fim, duracao_min, status, consentimento_lgpd_em,
  consentimento_versao, created_at, updated_at
) ON public.agendamentos TO authenticated;
GRANT UPDATE (status) ON public.agendamentos TO authenticated;
GRANT SELECT (id, agendamento_id, tipo, enviar_em, enviada_em, created_at, updated_at)
  ON public.notificacoes TO authenticated;

-- Enable and force RLS on every table containing teacher/student domain data.
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis FORCE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidades FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes FORCE ROW LEVEL SECURITY;

-- Policies: a teacher can manage their own profile and catalog/schedule data.
DROP POLICY IF EXISTS perfis_select_owner ON public.perfis;
CREATE POLICY perfis_select_owner ON public.perfis
  FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS perfis_insert_owner ON public.perfis;
CREATE POLICY perfis_insert_owner ON public.perfis
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS perfis_update_owner ON public.perfis;
CREATE POLICY perfis_update_owner ON public.perfis
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS perfis_delete_owner ON public.perfis;

-- Anonymous reads are limited to active public lesson fields; owners manage all
-- columns of their own lessons. The composite booking FK preserves ownership.
DROP POLICY IF EXISTS aulas_public_read_active ON public.aulas;
CREATE POLICY aulas_public_read_active ON public.aulas
  FOR SELECT TO anon USING (ativo);
DROP POLICY IF EXISTS aulas_select_owner ON public.aulas;
CREATE POLICY aulas_select_owner ON public.aulas
  FOR SELECT TO authenticated USING (auth.uid() = professora_id);
DROP POLICY IF EXISTS aulas_insert_owner ON public.aulas;
CREATE POLICY aulas_insert_owner ON public.aulas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = professora_id);
DROP POLICY IF EXISTS aulas_update_owner ON public.aulas;
CREATE POLICY aulas_update_owner ON public.aulas
  FOR UPDATE TO authenticated USING (auth.uid() = professora_id) WITH CHECK (auth.uid() = professora_id);
DROP POLICY IF EXISTS aulas_delete_owner ON public.aulas;
CREATE POLICY aulas_delete_owner ON public.aulas
  FOR DELETE TO authenticated USING (auth.uid() = professora_id);

-- Weekly availability and date blocks are private and owner-managed.
DROP POLICY IF EXISTS disponibilidades_owner_all ON public.disponibilidades;
CREATE POLICY disponibilidades_owner_all ON public.disponibilidades
  FOR ALL TO authenticated
  USING (auth.uid() = professora_id)
  WITH CHECK (auth.uid() = professora_id);
DROP POLICY IF EXISTS bloqueios_owner_all ON public.bloqueios;
CREATE POLICY bloqueios_owner_all ON public.bloqueios
  FOR ALL TO authenticated
  USING (auth.uid() = professora_id)
  WITH CHECK (auth.uid() = professora_id);

-- Teachers may read their own appointments and update only the status column.
-- The token is deliberately omitted from their column-level SELECT privileges.
DROP POLICY IF EXISTS agendamentos_select_owner ON public.agendamentos;
CREATE POLICY agendamentos_select_owner ON public.agendamentos
  FOR SELECT TO authenticated USING (auth.uid() = professora_id);
DROP POLICY IF EXISTS agendamentos_update_owner ON public.agendamentos;
CREATE POLICY agendamentos_update_owner ON public.agendamentos
  FOR UPDATE TO authenticated
  USING (auth.uid() = professora_id)
  WITH CHECK (auth.uid() = professora_id);

-- Notification visibility is inherited only through the teacher's own booking.
DROP POLICY IF EXISTS notificacoes_select_owner ON public.notificacoes;
CREATE POLICY notificacoes_select_owner ON public.notificacoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.agendamentos AS ag
     WHERE ag.id = notificacoes.agendamento_id
       AND ag.professora_id = auth.uid()
  ));

-- Public student RPCs. Fixed search_path plus schema-qualified relations stop
-- object-shadowing attacks; EXECUTE is revoked from PUBLIC first.
REVOKE ALL ON FUNCTION public.atualizar_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calcular_fim_agendamento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._slot_disponivel(uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limpar_dados_antes_de_excluir_perfil() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agendar_notificacoes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_cancelamento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_horarios_livres(text, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_agendamento(text, uuid, timestamptz, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_agendamento(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reagendar_agendamento(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.excluir_dados_aluno(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_agendamento(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.listar_horarios_livres(text, uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento(text, uuid, timestamptz, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_agendamento(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reagendar_agendamento(uuid, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_dados_aluno(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_agendamento(uuid) TO anon, authenticated;

-- Document key business and privacy decisions in the database itself.
COMMENT ON TABLE public.perfis IS 'Perfil privado por professora; id corresponde a auth.users.id. A exclusao do usuario Auth remove os dados dependentes.';
COMMENT ON COLUMN public.perfis.antecedencia_cancelamento_horas IS 'Antecedencia minima configuravel para cancelar ou reagendar, entre 0 e 72 horas.';
COMMENT ON TABLE public.aulas IS 'Catalogo de aulas por professora. preco usa numeric(10,2); agendamentos existentes impedem exclusao da aula.';
COMMENT ON TABLE public.disponibilidades IS 'Faixas semanais em hora local America/Sao_Paulo; dia_semana segue EXTRACT(DOW), domingo=0.';
COMMENT ON TABLE public.bloqueios IS 'Datas locais sem novos agendamentos para a professora.';
COMMENT ON TABLE public.agendamentos IS 'Reservas com inicio/fim em timestamptz, consentimento LGPD obrigatorio e token privado para operacoes publicas.';
COMMENT ON COLUMN public.agendamentos.cancel_token IS 'UUID imprevisivel; nunca conceder SELECT anon. Usado exclusivamente pelas RPCs publicas de aluno.';
COMMENT ON COLUMN public.agendamentos.duracao_min IS 'Snapshot da duracao da aula no momento da reserva; mantem fim estavel se a aula for editada.';
COMMENT ON TABLE public.notificacoes IS 'Fila sem dados de contato; processamento deve ocorrer em worker confiavel usando service_role somente no servidor.';
COMMENT ON VIEW public.perfis_publicos IS 'Projecao publica estrita: somente slug e nome da professora.';
COMMENT ON VIEW public.aulas_publicas IS 'Projecao publica estrita: aulas ativas por slug, sem expor o id privado da professora.';
COMMENT ON VIEW public.regras_agendamento_publicas IS 'Projecao publica somente da antecedencia de cancelamento/reagendamento, necessaria para orientar o aluno.';

