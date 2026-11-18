import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const urlIsHttps = (() => {
  try {
    return new URL(supabaseUrl).protocol === 'https:';
  } catch {
    return false;
  }
})();

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.'
  : !urlIsHttps
    ? 'A URL do Supabase deve usar HTTPS.'
    : '';

export const supabase = !supabaseConfigError
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
