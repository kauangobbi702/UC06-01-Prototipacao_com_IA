-- The student foreign key was added after the original column-level SELECT
-- grants on agendamentos. The teacher's daily agenda reads this column.
GRANT SELECT (aluno_id) ON TABLE public.agendamentos TO authenticated;
