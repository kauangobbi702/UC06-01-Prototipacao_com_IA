import { supabase } from './supabase.js';

function exigirSupabase() {
  if (!supabase) throw new Error('Configure as variáveis públicas do Supabase no arquivo .env.');
}

export async function listarAulas(professoraId) {
  exigirSupabase();
  if (!professoraId) throw new Error('Informe a professora para consultar o catálogo privado.');

  const { data, error } = await supabase
    .from('aulas')
    .select('id,nome,duracao_min,preco,ativo')
    .eq('professora_id', professoraId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function cadastrarAula(aula) {
  exigirSupabase();
  const { data, error } = await supabase
    .from('aulas')
    .insert({
      professora_id: aula.professora_id,
      nome: aula.nome,
      duracao_min: aula.duracao_min,
      preco: aula.preco,
      ativo: true,
    })
    .select('id,nome,duracao_min,preco,ativo')
    .single();
  if (error) throw error;
  return data;
}
