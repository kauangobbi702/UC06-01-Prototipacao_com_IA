import { supabase, usarPersistenciaLocal } from './supabase.js';

const STORAGE_KEY = 'prototipo-aulas-lesson-types';

function gerarId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `aula-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function lerAulasLocais() {
  try {
    const dados = localStorage.getItem(STORAGE_KEY);
    const lista = dados ? JSON.parse(dados) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function salvarAulasLocais(aulas) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aulas));
  } catch {
    // Ignorar falhas de armazenamento em ambiente restritivo.
  }
}

function listarAulasLocais() {
  return lerAulasLocais().sort((a, b) => {
    const dataA = new Date(a.created_at || 0).getTime();
    const dataB = new Date(b.created_at || 0).getTime();
    return dataA - dataB;
  });
}

async function listarAulasSupabase() {
  const { data, error } = await supabase
    .from('lesson_types')
    .select('id, name, duration_minutes, price_cents')
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Resposta inesperada do servidor');
  return data;
}

async function cadastrarAulaSupabase(aula) {
  const { error } = await supabase.from('lesson_types').insert(aula);
  if (error) throw error;
}

export async function listarAulas() {
  if (usarPersistenciaLocal()) {
    return listarAulasLocais();
  }

  return listarAulasSupabase();
}

export async function cadastrarAula(aula) {
  if (usarPersistenciaLocal()) {
    const novoRegistro = {
      ...aula,
      id: aula.id || gerarId(),
      created_at: new Date().toISOString(),
    };

    const aulas = listarAulasLocais();
    aulas.push(novoRegistro);
    salvarAulasLocais(aulas);
    return novoRegistro;
  }

  return cadastrarAulaSupabase(aula);
}
