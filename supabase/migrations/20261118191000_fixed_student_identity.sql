-- Keep one persistent student record per teacher and normalized contact.
-- Existing appointments are backfilled so the migration preserves history.
CREATE TABLE IF NOT EXISTS public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professora_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 2 AND 120),
  email text,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alunos_contato_obrigatorio CHECK (
    (email IS NOT NULL AND btrim(email) <> '')
    OR (telefone IS NOT NULL AND btrim(telefone) <> '')
  ),
  CONSTRAINT alunos_email_normalizado CHECK (
    email IS NULL OR (
      email = lower(btrim(email))
      AND char_length(email) <= 254
      AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  CONSTRAINT alunos_telefone_normalizado CHECK (
    telefone IS NULL OR telefone ~ '^[0-9]{10,15}$'
  )
);

-- Email is the primary stable identifier. Phone-only students are matched by
-- digits-only phone; allowing duplicate phones for email-backed students avoids
-- merging unrelated students that happen to share a contact number.
CREATE UNIQUE INDEX IF NOT EXISTS alunos_professora_email_uidx
  ON public.alunos (professora_id, email)
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS alunos_professora_telefone_uidx
  ON public.alunos (professora_id, telefone)
  WHERE email IS NULL AND telefone IS NOT NULL;
CREATE INDEX IF NOT EXISTS alunos_professora_idx
  ON public.alunos (professora_id);

-- Create one student for each existing contact and attach its appointments.
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS aluno_id uuid;

INSERT INTO public.alunos (professora_id, nome, email, telefone)
SELECT DISTINCT ON (
         ag.professora_id,
         COALESCE(
           'email:' || lower(btrim(ag.aluno_email)),
           'telefone:' || pg_catalog.regexp_replace(ag.aluno_telefone, '[^0-9]', '', 'g')
         )
       )
       ag.professora_id,
       btrim(ag.aluno_nome),
       nullif(lower(btrim(ag.aluno_email)), ''),
       nullif(pg_catalog.regexp_replace(ag.aluno_telefone, '[^0-9]', '', 'g'), '')
  FROM public.agendamentos AS ag
 WHERE ag.aluno_id IS NULL
 ORDER BY
       ag.professora_id,
       COALESCE(
         'email:' || lower(btrim(ag.aluno_email)),
         'telefone:' || pg_catalog.regexp_replace(ag.aluno_telefone, '[^0-9]', '', 'g')
       ),
       ag.created_at,
       ag.id
ON CONFLICT DO NOTHING;

UPDATE public.agendamentos AS ag
   SET aluno_id = al.id
  FROM public.alunos AS al
 WHERE ag.aluno_id IS NULL
   AND ag.professora_id = al.professora_id
   AND (
     (ag.aluno_email IS NOT NULL AND al.email = lower(btrim(ag.aluno_email)))
     OR (
       ag.aluno_email IS NULL
       AND al.email IS NULL
       AND al.telefone = pg_catalog.regexp_replace(ag.aluno_telefone, '[^0-9]', '', 'g')
     )
   );

ALTER TABLE public.agendamentos
  ALTER COLUMN aluno_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_constraint
     WHERE conname = 'agendamentos_aluno_fk'
       AND conrelid = 'public.agendamentos'::regclass
  ) THEN
    ALTER TABLE public.agendamentos
      ADD CONSTRAINT agendamentos_aluno_fk
      FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS agendamentos_aluno_idx
  ON public.agendamentos (aluno_id);

-- The teacher may read their own student list; public students only use the
-- SECURITY DEFINER booking RPCs and receive no direct table privileges.
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alunos_select_owner ON public.alunos;
CREATE POLICY alunos_select_owner ON public.alunos
  FOR SELECT TO authenticated USING (auth.uid() = professora_id);
REVOKE ALL ON TABLE public.alunos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.alunos TO authenticated;
GRANT ALL ON TABLE public.alunos TO service_role;

-- Store each new booking under the matching persistent student identity.
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
  v_aluno_id uuid;
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
  v_telefone := nullif(pg_catalog.regexp_replace(v_telefone, '[^0-9]', '', 'g'), '');

  SELECT p.id INTO v_professora_id
    FROM public.perfis AS p
   WHERE p.slug = lower(btrim($1));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Professora ou aula não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public._slot_disponivel(v_professora_id, $2, $3, NULL) THEN
    RAISE EXCEPTION 'Horário não disponível' USING ERRCODE = 'P0001';
  END IF;

  IF v_email IS NOT NULL THEN
    INSERT INTO public.alunos (professora_id, nome, email, telefone)
    VALUES (v_professora_id, btrim($4), v_email, v_telefone)
    ON CONFLICT (professora_id, email) WHERE email IS NOT NULL
    DO UPDATE SET
      nome = EXCLUDED.nome,
      telefone = COALESCE(EXCLUDED.telefone, public.alunos.telefone),
      updated_at = pg_catalog.now()
    RETURNING id INTO v_aluno_id;
  ELSE
    INSERT INTO public.alunos (professora_id, nome, telefone)
    VALUES (v_professora_id, btrim($4), v_telefone)
    ON CONFLICT (professora_id, telefone)
      WHERE email IS NULL AND telefone IS NOT NULL
    DO UPDATE SET nome = EXCLUDED.nome, updated_at = pg_catalog.now()
    RETURNING id INTO v_aluno_id;
  END IF;

  BEGIN
    INSERT INTO public.agendamentos (
      professora_id, aluno_id, aula_id, aluno_nome, aluno_email, aluno_telefone,
      inicio, fim, duracao_min, status,
      consentimento_lgpd_em, consentimento_versao
    )
    SELECT v_professora_id, v_aluno_id, a.id, btrim($4), v_email, v_telefone,
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

-- Remove the student row after its last appointment is erased; existing
-- appointments for the same student retain their shared identity.
CREATE OR REPLACE FUNCTION public.excluir_dados_aluno(cancel_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_id uuid;
  v_aluno_id uuid;
BEGIN
  IF $1 IS NULL THEN
    RAISE EXCEPTION 'Token inválido' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.agendamentos
   WHERE cancel_token = $1
  RETURNING id, aluno_id INTO v_id, v_aluno_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.alunos AS al
   WHERE al.id = v_aluno_id
     AND NOT EXISTS (
       SELECT 1 FROM public.agendamentos AS ag WHERE ag.aluno_id = al.id
     );
  RETURN true;
END;
$$;

COMMENT ON TABLE public.alunos IS
  'Identidade persistente do aluno por professora; e-mail normalizado é a chave principal, telefone é usado quando não há e-mail.';
COMMENT ON COLUMN public.agendamentos.aluno_id IS
  'Referência ao aluno persistente; várias aulas podem pertencer à mesma identidade.';

REVOKE ALL ON FUNCTION public.criar_agendamento(text, uuid, timestamptz, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.excluir_dados_aluno(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento(text, uuid, timestamptz, text, text, text, boolean)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_dados_aluno(uuid)
  TO anon, authenticated;
