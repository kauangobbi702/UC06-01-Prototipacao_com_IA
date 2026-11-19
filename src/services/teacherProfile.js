import { supabase } from '../../supabase.js';

function slugify(name) {
  return name.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

export async function loadOrCreateTeacherProfile(user) {
  const { data: existing, error: selectError } = await supabase
    .from('perfis')
    .select('id,nome,slug,antecedencia_cancelamento_horas')
    .eq('id', user.id)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;

  const name = String(user.user_metadata?.nome || user.email?.split('@')[0] || 'Professora').trim();
  const baseSlug = slugify(name) || 'professora';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${user.id.replace(/-/g, '').slice(0, 6 + attempt)}`;
    const { data, error } = await supabase
      .from('perfis')
      .insert({ id: user.id, nome: name, slug })
      .select('id,nome,slug,antecedencia_cancelamento_horas')
      .single();
    if (!error) return data;
    if (error.code !== '23505') throw error;

    const { data: racedProfile, error: lookupError } = await supabase
      .from('perfis')
      .select('id,nome,slug,antecedencia_cancelamento_horas')
      .eq('id', user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (racedProfile) return racedProfile;
  }
  throw new Error('Não foi possível gerar um link único para a professora.');
}
