import { listarAulas, cadastrarAula } from './lessonTypes.js';
import {
  digitosParaCentavos,
  formatarCampoPreco,
  formatarPreco,
  validarAula,
} from './lessonValidation.js';

const ICONE_AULA = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';

const telaLista = document.querySelector('#tela-lista');
const telaForm = document.querySelector('#tela-form');
const navegacao = document.querySelector('#navegacao');
const listaAulas = document.querySelector('#lista-aulas');
const resumo = document.querySelector('#resumo');
const listaStatus = document.querySelector('#lista-status');
const erroLista = document.querySelector('#erro-lista');
const estadoVazio = document.querySelector('#estado-vazio');
const btnCopiar = document.querySelector('#btn-copiar');
const chipTexto = document.querySelector('#chip-texto');

const formAula = document.querySelector('#form-aula');
const tituloForm = document.querySelector('#form-titulo');
const btnSalvar = document.querySelector('#btn-salvar');
const erroGeral = document.querySelector('#erro-geral');
const campos = {
  nome: { input: document.querySelector('#campo-nome'), erro: document.querySelector('#erro-nome') },
  duracao: { input: document.querySelector('#campo-duracao'), erro: document.querySelector('#erro-duracao') },
  preco: { input: document.querySelector('#campo-preco'), erro: document.querySelector('#erro-preco') },
};

const TEXTO_CHIP = 'Copiar link de agendamento';
let temporizadorChip;

const ESCAPES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escaparHtml(texto) {
  return texto.replace(/[&<>"']/g, (caractere) => ESCAPES_HTML[caractere]);
}

function renderizarCard(aula) {
  const nome = escaparHtml(aula.name);
  return `
    <li>
      <button type="button" aria-label="Editar ${nome}" class="group flex min-h-[44px] w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-primary/10">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE_AULA}</svg>
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center justify-between gap-2">
            <span class="truncate font-semibold text-text">${nome}</span>
            <span class="shrink-0 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-800">Ativa</span>
          </span>
          <span class="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${aula.duration_minutes} min</span>
            <span aria-hidden="true">·</span>
            <span>${formatarPreco(aula.price_cents)}</span>
          </span>
        </span>
        <svg class="h-5 w-5 shrink-0 text-muted transition duration-200 group-hover:translate-x-0.5 group-hover:text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </li>`;
}

function exibirAulas(aulas) {
  listaStatus.hidden = true;
  erroLista.hidden = true;

  if (aulas.length === 0) {
    resumo.hidden = true;
    listaAulas.innerHTML = '';
    estadoVazio.hidden = false;
    return;
  }

  estadoVazio.hidden = true;
  resumo.hidden = false;
  resumo.textContent =
    aulas.length === 1 ? '1 tipo de aula ativo' : `${aulas.length} tipos de aula ativos`;
  listaAulas.innerHTML = aulas.map(renderizarCard).join('');
}

async function carregarAulas() {
  listaAulas.innerHTML = '';
  resumo.hidden = true;
  estadoVazio.hidden = true;
  erroLista.hidden = true;

  if (location.hash === '#vazio') {
    listaStatus.hidden = true;
    estadoVazio.hidden = false;
    return;
  }

  listaStatus.textContent = 'Carregando suas aulas...';
  listaStatus.hidden = false;

  try {
    exibirAulas(await listarAulas());
  } catch {
    listaStatus.hidden = true;
    erroLista.hidden = false;
  }
}

function definirErro(chave, mensagem = '') {
  const { input, erro } = campos[chave];
  erro.textContent = mensagem;
  erro.hidden = !mensagem;
  input.setAttribute('aria-invalid', String(Boolean(mensagem)));
}

function limparErrosFormulario() {
  erroGeral.hidden = true;
  Object.keys(campos).forEach((chave) => definirErro(chave));
}

function abrirFormulario() {
  formAula.reset();
  limparErrosFormulario();
  tituloForm.focus();
}

function atualizarTela() {
  const formularioAberto = location.hash === '#nova-aula';
  telaLista.hidden = formularioAberto;
  telaForm.hidden = !formularioAberto;
  navegacao.hidden = formularioAberto;

  if (formularioAberto) {
    abrirFormulario();
  } else {
    carregarAulas();
  }
}

campos.nome.input.addEventListener('input', () => definirErro('nome'));

campos.duracao.input.addEventListener('input', () => {
  campos.duracao.input.value = campos.duracao.input.value.replace(/\D/g, '').slice(0, 3);
  definirErro('duracao');
});

campos.preco.input.addEventListener('input', () => {
  campos.preco.input.value = formatarCampoPreco(digitosParaCentavos(campos.preco.input.value));
  definirErro('preco');
});

formAula.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  erroGeral.hidden = true;

  const dados = {
    nome: campos.nome.input.value,
    duracao: campos.duracao.input.value,
    precoCentavos: digitosParaCentavos(campos.preco.input.value),
  };
  const erros = validarAula(dados);
  Object.keys(campos).forEach((chave) => definirErro(chave, erros[chave]));

  const primeiroCampoInvalido = Object.keys(campos).find((chave) => erros[chave]);
  if (primeiroCampoInvalido) {
    campos[primeiroCampoInvalido].input.focus();
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.textContent = 'Salvando...';
  try {
    await cadastrarAula({
      name: dados.nome.trim(),
      duration_minutes: Number(dados.duracao),
      price_cents: dados.precoCentavos,
    });
    location.hash = '';
  } catch {
    erroGeral.textContent = 'Não foi possível salvar a aula agora. Verifique sua conexão e tente de novo. Seus dados continuam preenchidos.';
    erroGeral.hidden = false;
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar aula';
  }
});

document.querySelector('#tentar-novamente').addEventListener('click', carregarAulas);

btnCopiar.addEventListener('click', async () => {
  let mensagem = 'Link copiado!';
  try {
    await navigator.clipboard.writeText(location.href.split('#')[0]);
  } catch {
    mensagem = 'Não foi possível copiar';
  }
  chipTexto.textContent = mensagem;
  clearTimeout(temporizadorChip);
  temporizadorChip = setTimeout(() => {
    chipTexto.textContent = TEXTO_CHIP;
  }, 2000);
});

window.addEventListener('hashchange', atualizarTela);
atualizarTela();
