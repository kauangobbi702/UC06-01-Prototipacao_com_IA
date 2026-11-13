import { supabase } from './supabase.js';

export async function listarAulas() {
  const { data, error } = await supabase
    .from('lesson_types')
    .select('id, name, duration_minutes, price_cents')
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Resposta inesperada do servidor');
  return data;
}

export async function cadastrarAula(aula) {
  const { error } = await supabase.from('lesson_types').insert(aula);
  if (error) throw error;
}
