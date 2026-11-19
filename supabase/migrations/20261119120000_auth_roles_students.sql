-- Register one immutable application role per Supabase Auth account.
CREATE TABLE IF NOT EXISTS public.usuarios_roles (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('professora', 'aluno')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Existing teacher profiles predate role registration and remain teachers.
INSERT INTO public.usuarios_roles (usuario_id, papel)
SELECT p.id, 'professora'
  FROM public.perfis AS p
ON CONFLICT (usuario_id) DO NOTHING;

-- Student profiles are private and share identity only with their Auth user.
CREATE TABLE IF NOT EXISTS public.perfis_alunos (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 3 AND 120),
  email text,
  telefone text,
  consentimento_lgpd_em timestamptz NOT NULL,
  consentimento_versao text NOT NULL
    CHECK (char_length(btrim(consentimento_versao)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perfis_alunos_contato_obrigatorio CHECK (
    (email IS NOT NULL AND btrim(email) <> '')
    OR (telefone IS NOT NULL AND btrim(telefone) <> '')
  ),
  CONSTRAINT perfis_alunos_email_formato CHECK (
    email IS NULL OR (
      email = lower(btrim(email))
      AND char_length(email) <= 254
      AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  CONSTRAINT perfis_alunos_telefone_formato CHECK (
    telefone IS NULL OR (
      char_length(telefone) <= 24
      AND telefone ~ '^\+?[0-9][0-9 ()-]{8,22}$'
      AND char_length(pg_catalog.regexp_replace(telefone, '[^0-9]', '', 'g')) BETWEEN 10 AND 15
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS perfis_alunos_email_uidx
  ON public.perfis_alunos (email)
  WHERE email IS NOT NULL;

-- Teacher profiles can store a contact number for account recovery/contact.
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS telefone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conname = 'perfis_telefone_formato'
       AND conrelid = 'public.perfis'::regclass
  ) THEN
    ALTER TABLE public.perfis
      ADD CONSTRAINT perfis_telefone_formato CHECK (
        telefone IS NULL OR (
          char_length(telefone) <= 24
          AND telefone ~ '^\+?[0-9][0-9 ()-]{8,22}$'
          AND char_length(pg_catalog.regexp_replace(telefone, '[^0-9]', '', 'g')) BETWEEN 10 AND 15
        )
      );
  END IF;
END;
$$;

-- Link pre-existing contact-based students to Auth without changing history.
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS conta_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conname = 'alunos_conta_fk'
       AND conrelid = 'public.alunos'::regclass
  ) THEN
    ALTER TABLE public.alunos
      ADD CONSTRAINT alunos_conta_fk
      FOREIGN KEY (conta_id) REFERENCES public.perfis_alunos(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS alunos_professora_conta_uidx
  ON public.alunos (professora_id, conta_id)
  WHERE conta_id IS NOT NULL;

-- Only trusted functions read the role registry; clients cannot choose or
-- change their role by writing Auth user metadata.
ALTER TABLE public.usuarios_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_roles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.usuarios_roles FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.usuarios_roles TO service_role;

-- Read the caller's role from the protected registry for RLS checks.
CREATE OR REPLACE FUNCTION public.papel_atual()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT r.papel
    FROM public.usuarios_roles AS r
   WHERE r.usuario_id = auth.uid()
$$;

-- Public slug availability reveals only whether a candidate URL is free.
CREATE OR REPLACE FUNCTION public.slug_disponivel(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_slug text := lower(btrim(p_slug));
BEGIN
  IF v_slug IS NULL OR char_length(v_slug) NOT BETWEEN 3 AND 80
     OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM public.perfis AS p WHERE p.slug = v_slug
  );
END;
$$;

-- Provision the correct profile after Auth signup/login. The role registry
-- serializes concurrent requests and prevents one account from holding both
-- teacher and student profiles. The optional consent flag is required for
-- student provisioning and is supplied only after the signup checkbox.
CREATE OR REPLACE FUNCTION public.garantir_perfil(
  p_papel text,
  p_nome text,
  p_telefone text DEFAULT NULL,
  p_slug text DEFAULT NULL,
  p_aceite_lgpd boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_papel text;
  v_nome text := btrim(p_nome);
  v_slug text := lower(btrim(p_slug));
  v_telefone text := nullif(btrim(p_telefone), '');
  v_email text;
  v_professora public.perfis%ROWTYPE;
  v_aluno public.perfis_alunos%ROWTYPE;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE = '42501';
  END IF;
  IF p_papel NOT IN ('professora', 'aluno')
     OR v_nome IS NULL
     OR char_length(v_nome) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Perfil ou nome inválido' USING ERRCODE = '22023';
  END IF;
  IF v_telefone IS NOT NULL
     AND (
       char_length(v_telefone) > 24
       OR v_telefone !~ '^\+?[0-9][0-9 ()-]{8,22}$'
       OR char_length(pg_catalog.regexp_replace(v_telefone, '[^0-9]', '', 'g')) NOT BETWEEN 10 AND 15
     ) THEN
    RAISE EXCEPTION 'Informe um telefone válido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.usuarios_roles (usuario_id, papel)
  VALUES (v_usuario_id, p_papel)
  ON CONFLICT (usuario_id) DO NOTHING;

  SELECT r.papel INTO v_papel
    FROM public.usuarios_roles AS r
   WHERE r.usuario_id = v_usuario_id
   FOR UPDATE;
  IF v_papel IS DISTINCT FROM p_papel THEN
    RAISE EXCEPTION 'O papel desta conta não pode ser alterado' USING ERRCODE = '42501';
  END IF;

  IF p_papel = 'professora' THEN
    SELECT p.* INTO v_professora
      FROM public.perfis AS p
     WHERE p.id = v_usuario_id;

    IF NOT FOUND THEN
      IF v_slug IS NULL OR char_length(v_slug) NOT BETWEEN 3 AND 80
         OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
        RAISE EXCEPTION 'Informe um link válido para sua página' USING ERRCODE = '22023';
      END IF;
      BEGIN
        INSERT INTO public.perfis (id, nome, telefone, slug)
        VALUES (v_usuario_id, v_nome, v_telefone, v_slug);
      EXCEPTION
        WHEN unique_violation THEN
          RAISE EXCEPTION 'Este link já está em uso' USING ERRCODE = 'P0001';
      END;

      SELECT p.* INTO v_professora
        FROM public.perfis AS p
       WHERE p.id = v_usuario_id;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'id', v_professora.id,
      'papel', 'professora',
      'nome', v_professora.nome,
      'telefone', v_professora.telefone,
      'slug', v_professora.slug,
      'antecedencia_cancelamento_horas', v_professora.antecedencia_cancelamento_horas
    );
  END IF;

  IF p_aceite_lgpd IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'O consentimento LGPD é obrigatório' USING ERRCODE = '22023';
  END IF;

  SELECT lower(btrim(u.email)) INTO v_email
    FROM auth.users AS u
   WHERE u.id = v_usuario_id;
  v_email := nullif(v_email, '');
  IF v_email IS NULL AND v_telefone IS NULL THEN
    RAISE EXCEPTION 'Informe um e-mail ou telefone para contato' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.perfis_alunos (
    id, nome, email, telefone, consentimento_lgpd_em, consentimento_versao
  )
  VALUES (
    v_usuario_id, v_nome, v_email, v_telefone, pg_catalog.now(), 'agendamento-v1'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT p.* INTO v_aluno
    FROM public.perfis_alunos AS p
   WHERE p.id = v_usuario_id;

  IF v_aluno.email IS NOT NULL THEN
    UPDATE public.alunos AS a
       SET conta_id = v_usuario_id,
           updated_at = pg_catalog.now()
     WHERE a.email = v_aluno.email
       AND a.conta_id IS NULL;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_aluno.id,
    'papel', 'aluno',
    'nome', v_aluno.nome,
    'email', v_aluno.email,
    'telefone', v_aluno.telefone,
    'consentimento_lgpd_em', v_aluno.consentimento_lgpd_em,
    'consentimento_versao', v_aluno.consentimento_versao
  );
END;
$$;

-- Profile access is limited to the owning role; profile creation is performed
-- by garantir_perfil rather than direct client INSERT.
ALTER TABLE public.perfis_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_alunos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS perfis_alunos_select_owner ON public.perfis_alunos;
CREATE POLICY perfis_alunos_select_owner ON public.perfis_alunos
  FOR SELECT TO authenticated
  USING (auth.uid() = id AND public.papel_atual() = 'aluno');
DROP POLICY IF EXISTS perfis_alunos_update_owner ON public.perfis_alunos;
CREATE POLICY perfis_alunos_update_owner ON public.perfis_alunos
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND public.papel_atual() = 'aluno')
  WITH CHECK (auth.uid() = id AND public.papel_atual() = 'aluno');

REVOKE ALL ON TABLE public.perfis_alunos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.perfis_alunos TO authenticated;
GRANT UPDATE (nome, telefone) ON TABLE public.perfis_alunos TO authenticated;
GRANT ALL ON TABLE public.perfis_alunos TO service_role;

DROP TRIGGER IF EXISTS perfis_alunos_updated_at ON public.perfis_alunos;
CREATE TRIGGER perfis_alunos_updated_at BEFORE UPDATE ON public.perfis_alunos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- Only a teacher can manage teacher-owned records; a student can read their
-- own contact-based student row after it is linked to their Auth account.
DROP POLICY IF EXISTS perfis_select_owner ON public.perfis;
CREATE POLICY perfis_select_owner ON public.perfis
  FOR SELECT TO authenticated
  USING (auth.uid() = id AND public.papel_atual() = 'professora');
DROP POLICY IF EXISTS perfis_insert_owner ON public.perfis;
DROP POLICY IF EXISTS perfis_update_owner ON public.perfis;
CREATE POLICY perfis_update_owner ON public.perfis
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND public.papel_atual() = 'professora')
  WITH CHECK (auth.uid() = id AND public.papel_atual() = 'professora');
REVOKE INSERT ON TABLE public.perfis FROM authenticated;
REVOKE UPDATE ON TABLE public.perfis FROM authenticated;
GRANT UPDATE (nome, telefone, slug, antecedencia_cancelamento_horas)
  ON TABLE public.perfis TO authenticated;

DROP POLICY IF EXISTS aulas_select_owner ON public.aulas;
CREATE POLICY aulas_select_owner ON public.aulas
  FOR SELECT TO authenticated
  USING (auth.uid() = professora_id AND public.papel_atual() = 'professora');
DROP POLICY IF EXISTS aulas_insert_owner ON public.aulas;
CREATE POLICY aulas_insert_owner ON public.aulas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = professora_id AND public.papel_atual() = 'professora');
DROP POLICY IF EXISTS aulas_update_owner ON public.aulas;
CREATE POLICY aulas_update_owner ON public.aulas
  FOR UPDATE TO authenticated
  USING (auth.uid() = professora_id AND public.papel_atual() = 'professora')
  WITH CHECK (auth.uid() = professora_id AND public.papel_atual() = 'professora');
DROP POLICY IF EXISTS aulas_delete_owner ON public.aulas;
CREATE POLICY aulas_delete_owner ON public.aulas
  FOR DELETE TO authenticated
  USING (auth.uid() = professora_id AND public.papel_atual() = 'professora');

DROP POLICY IF EXISTS disponibilidades_owner_all ON public.disponibilidades;
CREATE POLICY disponibilidades_owner_all ON public.disponibilidades
  FOR ALL TO authenticated
  USING (auth.uid() = professora_id AND public.papel_atual() = 'professora')
  WITH CHECK (auth.uid() = professora_id AND public.papel_atual() = 'professora');
DROP POLICY IF EXISTS bloqueios_owner_all ON public.bloqueios;
CREATE POLICY bloqueios_owner_all ON public.bloqueios
  FOR ALL TO authenticated
  USING (auth.uid() = professora_id AND public.papel_atual() = 'professora')
  WITH CHECK (auth.uid() = professora_id AND public.papel_atual() = 'professora');

DROP POLICY IF EXISTS alunos_select_owner ON public.alunos;
DROP POLICY IF EXISTS alunos_select_owner_or_account ON public.alunos;
CREATE POLICY alunos_select_owner_or_account ON public.alunos
  FOR SELECT TO authenticated
  USING (
    (public.papel_atual() = 'professora' AND professora_id = auth.uid())
    OR (public.papel_atual() = 'aluno' AND conta_id = auth.uid())
  );

DROP POLICY IF EXISTS agendamentos_select_owner ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_select_owner_or_student ON public.agendamentos;
CREATE POLICY agendamentos_select_owner_or_student ON public.agendamentos
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = professora_id AND public.papel_atual() = 'professora')
    OR (
      public.papel_atual() = 'aluno'
      AND EXISTS (
        SELECT 1 FROM public.alunos AS a
         WHERE a.id = agendamentos.aluno_id
           AND a.conta_id = auth.uid()
      )
    )
  );
DROP POLICY IF EXISTS agendamentos_update_owner ON public.agendamentos;
CREATE POLICY agendamentos_update_owner ON public.agendamentos
  FOR UPDATE TO authenticated
  USING (auth.uid() = professora_id AND public.papel_atual() = 'professora')
  WITH CHECK (auth.uid() = professora_id AND public.papel_atual() = 'professora');

DROP POLICY IF EXISTS notificacoes_select_owner ON public.notificacoes;
CREATE POLICY notificacoes_select_owner ON public.notificacoes
  FOR SELECT TO authenticated
  USING (
    public.papel_atual() = 'professora'
    AND EXISTS (
      SELECT 1 FROM public.agendamentos AS ag
       WHERE ag.id = notificacoes.agendamento_id
         AND ag.professora_id = auth.uid()
    )
  );

-- Authenticated students see only their own appointments; use a table-valued
-- RPC for the app's joined view instead of exposing cancel tokens.
CREATE OR REPLACE FUNCTION public.listar_meus_agendamentos()
RETURNS TABLE (
  id uuid,
  aula_id uuid,
  aula_nome text,
  preco numeric(10,2),
  professora_id uuid,
  professora_nome text,
  professora_slug text,
  inicio timestamptz,
  fim timestamptz,
  duracao_min smallint,
  status text,
  antecedencia_cancelamento_horas smallint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.papel_atual() IS DISTINCT FROM 'aluno' THEN
    RAISE EXCEPTION 'Acesso exclusivo para aluno autenticado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ag.id, ag.aula_id, a.nome, a.preco, p.id, p.nome, p.slug,
         ag.inicio, ag.fim, ag.duracao_min, ag.status,
         p.antecedencia_cancelamento_horas
    FROM public.agendamentos AS ag
    JOIN public.alunos AS al ON al.id = ag.aluno_id
    JOIN public.aulas AS a ON a.id = ag.aula_id
    JOIN public.perfis AS p ON p.id = ag.professora_id
   WHERE al.conta_id = auth.uid()
   ORDER BY ag.inicio;
END;
$$;

-- Booking by account identity links every new reservation to one existing
-- student row for that teacher and rechecks slot availability transactionally.
CREATE OR REPLACE FUNCTION public.criar_agendamento(
  p_slug text,
  p_aula_id uuid,
  p_inicio timestamptz,
  p_aceite_lgpd boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_aluno public.perfis_alunos%ROWTYPE;
  v_professora_id uuid;
  v_aluno_id uuid;
  v_telefone text;
  v_agendamento_id uuid;
BEGIN
  IF v_usuario_id IS NULL OR public.papel_atual() IS DISTINCT FROM 'aluno' THEN
    RAISE EXCEPTION 'Acesso exclusivo para aluno autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_slug IS NULL OR char_length(btrim(p_slug)) NOT BETWEEN 1 AND 80
     OR p_aula_id IS NULL OR p_inicio IS NULL
     OR p_aceite_lgpd IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Dados inválidos ou consentimento obrigatório' USING ERRCODE = '22023';
  END IF;

  SELECT p.* INTO v_aluno
    FROM public.perfis_alunos AS p
   WHERE p.id = v_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de aluno não encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.id INTO v_professora_id
    FROM public.perfis AS p
   WHERE p.slug = lower(btrim(p_slug));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Professora não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public._slot_disponivel(v_professora_id, p_aula_id, p_inicio, NULL) THEN
    RAISE EXCEPTION 'Horário não disponível' USING ERRCODE = 'P0001';
  END IF;

  v_telefone := nullif(pg_catalog.regexp_replace(v_aluno.telefone, '[^0-9]', '', 'g'), '');
  IF v_aluno.email IS NOT NULL THEN
    INSERT INTO public.alunos (professora_id, conta_id, nome, email, telefone)
    VALUES (v_professora_id, v_usuario_id, v_aluno.nome, v_aluno.email, v_telefone)
    ON CONFLICT (professora_id, email) WHERE email IS NOT NULL
    DO UPDATE SET
      conta_id = COALESCE(public.alunos.conta_id, EXCLUDED.conta_id),
      nome = EXCLUDED.nome,
      telefone = COALESCE(EXCLUDED.telefone, public.alunos.telefone),
      updated_at = pg_catalog.now()
    RETURNING id INTO v_aluno_id;
  ELSE
    INSERT INTO public.alunos (professora_id, conta_id, nome, telefone)
    VALUES (v_professora_id, v_usuario_id, v_aluno.nome, v_telefone)
    ON CONFLICT (professora_id, telefone)
      WHERE email IS NULL AND telefone IS NOT NULL
    DO UPDATE SET
      conta_id = COALESCE(public.alunos.conta_id, EXCLUDED.conta_id),
      nome = EXCLUDED.nome,
      updated_at = pg_catalog.now()
    RETURNING id INTO v_aluno_id;
  END IF;

  BEGIN
    INSERT INTO public.agendamentos (
      professora_id, aluno_id, aula_id, aluno_nome, aluno_email, aluno_telefone,
      inicio, fim, duracao_min, status,
      consentimento_lgpd_em, consentimento_versao
    )
    SELECT v_professora_id, v_aluno_id, a.id, v_aluno.nome, v_aluno.email, v_aluno.telefone,
           p_inicio, p_inicio, a.duracao_min, 'confirmado',
           pg_catalog.now(), 'agendamento-v1'
      FROM public.aulas AS a
     WHERE a.id = p_aula_id
       AND a.professora_id = v_professora_id
       AND a.ativo
    RETURNING id INTO v_agendamento_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Horário não disponível' USING ERRCODE = 'P0001';
  END;

  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Aula não encontrada ou inativa' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_agendamento_id;
END;
$$;

-- Cancellation and rescheduling identify the appointment by ID but still
-- prove ownership through the linked account before changing it.
DROP FUNCTION IF EXISTS public.cancelar_agendamento(uuid);
CREATE FUNCTION public.cancelar_agendamento(p_agendamento_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_agendamento public.agendamentos%ROWTYPE;
  v_antecedencia smallint;
BEGIN
  IF auth.uid() IS NULL OR public.papel_atual() IS DISTINCT FROM 'aluno' THEN
    RAISE EXCEPTION 'Acesso exclusivo para aluno autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT ag.* INTO v_agendamento
    FROM public.agendamentos AS ag
    JOIN public.alunos AS al ON al.id = ag.aluno_id
   WHERE ag.id = p_agendamento_id
     AND al.conta_id = auth.uid()
     AND ag.status IN ('pendente', 'confirmado')
   FOR UPDATE OF ag;
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

DROP FUNCTION IF EXISTS public.reagendar_agendamento(uuid, timestamptz);
CREATE FUNCTION public.reagendar_agendamento(
  p_agendamento_id uuid,
  p_novo_inicio timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_agendamento public.agendamentos%ROWTYPE;
  v_antecedencia smallint;
BEGIN
  IF auth.uid() IS NULL OR public.papel_atual() IS DISTINCT FROM 'aluno' THEN
    RAISE EXCEPTION 'Acesso exclusivo para aluno autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_agendamento_id IS NULL OR p_novo_inicio IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT ag.* INTO v_agendamento
    FROM public.agendamentos AS ag
    JOIN public.alunos AS al ON al.id = ag.aluno_id
   WHERE ag.id = p_agendamento_id
     AND al.conta_id = auth.uid()
     AND ag.status IN ('pendente', 'confirmado')
   FOR UPDATE OF ag;
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
    p_novo_inicio,
    v_agendamento.id
  ) THEN
    RAISE EXCEPTION 'Novo horário não disponível' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.agendamentos
     SET inicio = p_novo_inicio
   WHERE id = v_agendamento.id;
  RETURN p_novo_inicio;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Novo horário não disponível' USING ERRCODE = 'P0001';
END;
$$;

-- Remove all of a student's reservations and Auth identity after an explicit
-- confirmation. Deleting appointments first releases slots and cascades queue
-- records; no personal values are written to logs.
CREATE OR REPLACE FUNCTION public.excluir_minha_conta_aluno()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
BEGIN
  IF v_usuario_id IS NULL OR public.papel_atual() IS DISTINCT FROM 'aluno' THEN
    RAISE EXCEPTION 'Acesso exclusivo para aluno autenticado' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.agendamentos AS ag
   WHERE ag.aluno_id IN (
     SELECT a.id FROM public.alunos AS a WHERE a.conta_id = v_usuario_id
   );
  DELETE FROM public.alunos WHERE conta_id = v_usuario_id;
  DELETE FROM public.usuarios_roles WHERE usuario_id = v_usuario_id;
  DELETE FROM auth.users WHERE id = v_usuario_id;
  RETURN true;
END;
$$;

-- Teacher account deletion cascades through the existing profile cleanup
-- trigger, removing teacher data and appointments before Auth is deleted.
CREATE OR REPLACE FUNCTION public.excluir_minha_conta_professora()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
BEGIN
  IF v_usuario_id IS NULL OR public.papel_atual() IS DISTINCT FROM 'professora' THEN
    RAISE EXCEPTION 'Acesso exclusivo para professora autenticada' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.usuarios_roles WHERE usuario_id = v_usuario_id;
  DELETE FROM auth.users WHERE id = v_usuario_id;
  RETURN true;
END;
$$;

-- Revoke the anonymous/token-based booking surface; students now operate only
-- on their own authenticated records through the account-scoped RPCs.
REVOKE ALL ON FUNCTION public.criar_agendamento(text, uuid, timestamptz, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_agendamento(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reagendar_agendamento(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.excluir_dados_aluno(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_agendamento(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_agendamento(text, uuid, timestamptz, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_meus_agendamentos()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.garantir_perfil(text, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.papel_atual()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.slug_disponivel(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_agendamento(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reagendar_agendamento(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.excluir_minha_conta_aluno()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.excluir_minha_conta_professora()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.slug_disponivel(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papel_atual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.garantir_perfil(text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_horarios_livres(text, uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_meus_agendamentos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento(text, uuid, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_agendamento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reagendar_agendamento(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_minha_conta_aluno() TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_minha_conta_professora() TO authenticated;

-- Document the role and account-deletion boundaries in the schema.
COMMENT ON TABLE public.usuarios_roles IS
  'One immutable application role per Auth user; modified only by trusted profile provisioning.';
COMMENT ON TABLE public.perfis_alunos IS
  'Private student profile linked one-to-one to auth.users; records signup LGPD consent.';
COMMENT ON COLUMN public.alunos.conta_id IS
  'Optional Auth account for a student; NULL preserves legacy contact-only history.';
COMMENT ON FUNCTION public.excluir_minha_conta_aluno() IS
  'Deletes only the caller student account and its appointments after explicit UI confirmation.';
COMMENT ON FUNCTION public.excluir_minha_conta_professora() IS
  'Deletes only the caller teacher account; the existing cleanup trigger removes dependent records.';
