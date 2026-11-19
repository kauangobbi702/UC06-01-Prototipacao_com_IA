export const STATUS = Object.freeze({
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
});

export function getSupabaseErrorMessage(error) {
  const code = error?.code;
  if (code === '23514') return 'Algum dado não atende às regras do formulário.';
  if (code === '23503') return 'Não foi possível concluir: há dados relacionados a este registro.';
  if (code === '23P01' || /hor.rio.*n.o dispon.vel/i.test(error?.message || '')) {
    return 'Esse horário acabou de ser reservado. Atualize os horários e escolha outro.';
  }
  if (code === '42501') return 'Você não tem permissão para executar esta ação.';
  if (/prazo.*encerrado/i.test(error?.message || '')) {
    return 'O prazo para alterar esta aula já terminou. Fale com a professora.';
  }
  if (/slug.*(indispon.vel|j. est.)/i.test(error?.message || '')) {
    return 'Este link já está em uso. Escolha outro nome para o seu link.';
  }
  return 'Não foi possível concluir agora. Tente novamente.';
}
