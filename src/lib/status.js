export const STATUS = Object.freeze({
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
});

export function getSupabaseErrorMessage(error) {
  const code = error?.code;
  const message = error?.message || '';
  if (code === '23514') return 'Algum dado não atende às regras do formulário.';
  if (code === '23503') return 'Não foi possível concluir: há dados relacionados a este registro.';
  if (/este link.*j. est. em uso|slug.*(indispon.vel|j. est.)/i.test(message)) {
    return 'Este link já está em uso. Escolha outro nome para o seu link.';
  }
  if (code === '23P01' || /hor.rio.*n.o dispon.vel/i.test(message)) {
    return 'Esse horário acabou de ser reservado. Atualize os horários e escolha outro.';
  }
  if (code === 'P0001' && /hor.rio|horário/i.test(message)) {
    return 'Esse horário acabou de ser reservado. Atualize os horários e escolha outro.';
  }
  if (code === '42501') return 'Você não tem permissão para executar esta ação.';
  if (/prazo.*encerrado/i.test(message)) {
    return 'O prazo para alterar esta aula já terminou. Fale com a professora.';
  }
  if (code === 'P0002') return 'Não encontramos o perfil, aula ou agendamento solicitado.';
  if (code === 'P0001') return 'Não foi possível concluir esta ação. Confira os dados e tente novamente.';
  return 'Não foi possível concluir agora. Tente novamente.';
}
