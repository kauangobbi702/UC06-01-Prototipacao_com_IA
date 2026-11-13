const MAXIMO_DIGITOS_PRECO = 9;

const formatadorValor = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function digitosParaCentavos(texto) {
  const digitos = texto.replace(/\D/g, '').slice(0, MAXIMO_DIGITOS_PRECO);
  return digitos ? Number(digitos) : 0;
}

export function formatarPreco(centavos) {
  return `R$ ${formatadorValor.format(centavos / 100)}`;
}

export function formatarCampoPreco(centavos) {
  return centavos > 0 ? formatarPreco(centavos) : '';
}

export function validarAula({ nome, duracao, precoCentavos }) {
  const erros = {};

  if (nome.trim().length < 3) {
    erros.nome = 'Use pelo menos 3 letras no nome da aula.';
  }

  const minutos = Number(duracao);
  if (!/^\d+$/.test(duracao) || minutos < 15 || minutos > 120) {
    erros.duracao = 'Informe um número inteiro entre 15 e 120 minutos.';
  }

  if (precoCentavos <= 0) {
    erros.preco = 'Informe um preço maior que R$ 0,00.';
  }

  return erros;
}
