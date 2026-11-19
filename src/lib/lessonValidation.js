export function validateLesson({ nome, duracao, precoCentavos }) {
  const errors = {};
  if (nome.trim().length < 3) errors.nome = 'Use pelo menos 3 caracteres no nome da aula.';
  if (!/^\d+$/.test(String(duracao)) || Number(duracao) < 15 || Number(duracao) > 120) {
    errors.duracao = 'Informe um número inteiro entre 15 e 120 minutos.';
  }
  if (Number(precoCentavos) <= 0) errors.preco = 'Informe um preço maior que R$ 0,00.';
  return errors;
}
