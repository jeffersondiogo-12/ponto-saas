import { useEffect, useState } from 'react';

/**
 * Uma unica fonte para o que aparece no menu — no computador e no celular.
 *
 * Antes as condicoes de cada item viviam soltas no JSX da `Layout`. Com o
 * celular tendo um menu proprio, elas passariam a existir em dois lugares, e a
 * primeira divergencia seria um item que aparece num tamanho de tela e some no
 * outro sem motivo. Aqui a condicao e escrita uma vez e os dois consomem.
 */

/**
 * Abaixo disso o sistema vira "celular" e passa a valer o menu reduzido.
 *
 * 640px, e nao os 860px do layout: entre 640 e 860 a dock ja deita e vira
 * barra horizontal (tablet, janela estreita no notebook), mas ali ainda cabe o
 * sistema inteiro. Cortar funcionalidade a 860px tiraria telas de quem esta num
 * notebook com a janela pela metade.
 */
export const LARGURA_CELULAR = 640;

/**
 * Cada item declara SUA condicao. `quando` recebe o contexto e devolve se o
 * item existe para aquela pessoa; sem `quando`, o item vale sempre.
 *
 * A ordem daqui e a ordem do menu no computador.
 */
export const ITENS_DOCK = [
  { para: '/dashboard', icone: 'visao', rotulo: 'Visão geral' },
  {
    para: '/professor',
    icone: 'professor',
    rotulo: 'Minhas turmas',
    // Por papel, e nao pela matriz: as rotas de /api/professores/minhas-turmas
    // exigem `exigirPapel('professor')` no servidor. Um gestor com
    // `professores:ver` chegaria aqui e tomaria 403.
    quando: ({ usuario }) => usuario?.papel === 'professor',
  },
  {
    para: '/gestao',
    icone: 'gestao',
    rotulo: 'Gestão',
    quando: ({ pode, ehEscola }) => pode('turmas', 'ver') && ehEscola,
  },
  {
    para: '/unidades',
    icone: 'unidades',
    rotulo: 'Unidades',
    quando: ({ pode }) => pode('filiais', 'ver'),
  },
  {
    para: '/avisos',
    icone: 'avisos',
    rotulo: 'Avisos',
    // Nao exige unidade do tipo escola: um admin no nivel da empresa manda
    // comunicado para todas as unidades de uma vez.
    quando: ({ pode }) => pode('avisos', 'ver'),
  },
  {
    para: '/turmas',
    icone: 'turmas',
    rotulo: 'Turmas',
    quando: ({ pode, ehEscola }) => pode('turmas', 'ver') && ehEscola,
  },
  {
    para: '/alunos',
    icone: 'alunos',
    rotulo: 'Alunos',
    quando: ({ pode, ehEscola }) => pode('alunos', 'ver') && ehEscola,
  },
  {
    para: '/funcionarios',
    icone: 'funcionarios',
    rotulo: 'Funcionários',
    quando: ({ pode, filialSelecionada }) => pode('funcionarios', 'ver')
      && (!filialSelecionada || filialSelecionada.tipo === 'empresa'),
  },
  {
    para: '/dispositivos',
    icone: 'dispositivos',
    rotulo: 'Dispositivos',
    quando: ({ pode }) => pode('dispositivos', 'ver'),
  },
  {
    para: '/usuarios',
    icone: 'usuarios',
    rotulo: 'Usuários',
    quando: ({ pode, ehEscola }) => pode('usuarios', 'ver') && ehEscola,
  },
  {
    para: '/auditoria',
    icone: 'auditoria',
    rotulo: 'Auditoria',
    quando: ({ pode }) => pode('auditoria', 'ver'),
  },
  {
    para: '/permissoes',
    icone: 'permissoes',
    rotulo: 'Permissões',
    // Administrar a matriz nao e um recurso dela — nao existe `permissoes` em
    // `permissoes_papeis`. As cinco rotas de /api/permissoes/* sao restritas a
    // super_admin no proprio servidor, entao aqui a checagem e por papel.
    quando: ({ usuario }) => usuario?.papel === 'super_admin',
  },
];

/**
 * O que cada papel alcanca NO CELULAR, em ordem — a primeira tela visivel e
 * tambem onde a pessoa cai ao entrar.
 *
 * Definido em 2026-09-06. E uma restricao de verdade: no celular as outras
 * telas nao aparecem no menu nem respondem por endereco direto.
 *
 * Isto diz QUAIS TELAS fazem sentido no celular, nunca o que a pessoa pode
 * fazer dentro delas — quem responde isso continua sendo a matriz de
 * permissoes, pelo `quando` de cada item. Os dois se somam: a tela precisa
 * estar nesta lista E passar na condicao.
 */
const TELAS_CELULAR = {
  super_admin: ['/dashboard', '/dispositivos'],
  admin: ['/unidades', '/responsaveis', '/turmas', '/avisos'],
  gestor: ['/alunos', '/turmas', '/responsaveis', '/avisos'],
};

/**
 * Rotas que valem em qualquer papel e em qualquer tamanho de tela.
 *
 * Sem elas o celular trava: o super_admin precisa escolher a empresa antes de
 * qualquer coisa, e quem foi deslogado precisa alcancar o login.
 */
const SEMPRE_ALCANCAVEIS = ['/login', '/selecionar-empresa'];

/**
 * A pessoa opera dentro de uma escola? Turma e aluno so existem em unidade
 * desse tipo, entao os itens que dependem disso ficariam levando a uma tela
 * sempre vazia.
 *
 * **Duas formas de estar numa escola, e a segunda faltava.** Ou a unidade foi
 * escolhida na tela, ou ela e FIXA NA CONTA (`usuario.filial_id`) — que e o
 * caso do gestor.
 *
 * Antes so a primeira contava, e o gestor ficava de fora das duas maneiras:
 *
 * 1. o login nunca devolve filial. `localizarUnidade` roda sem empresa, cai na
 *    busca global e consulta so a tabela `empresas` — `montarFilialSelecionada`
 *    devolve `null` para todo mundo;
 * 2. o `SelecionarFilialModal`, que resolveria isso, lista as unidades da
 *    empresa, e listar exige `filiais:ver`. O gestor nao tem: toma 403, o
 *    `catch` e silencioso e o modal nunca abre.
 *
 * Com as duas somadas, o gestor ficava com `ehEscola` falso para sempre e via
 * so Avisos, o unico item do menu que nao depende disto.
 *
 * Nao ha como o front descobrir o TIPO dessa unidade fixa — ler `/api/filiais/:id`
 * tambem exige `filiais:ver`. Aqui vale o que o modelo do produto diz: quem tem
 * unidade fixa e gestor, e gestor e o papel da escola. O servidor escopa tudo
 * por `usuario.filial_id` de qualquer forma, entao o conserto certo e o login
 * devolver essa filial — registrado na secao 7 do CLAUDE.md.
 */
export function operaEmEscola(usuario, filialSelecionada) {
  if (filialSelecionada) return filialSelecionada.tipo === 'escola';
  return Boolean(usuario?.filial_id);
}

/** Verdadeiro quando a janela esta na faixa de celular. */
export function useCelular() {
  const [celular, setCelular] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= LARGURA_CELULAR,
  );

  useEffect(() => {
    const consulta = window.matchMedia(`(max-width: ${LARGURA_CELULAR}px)`);
    const aoMudar = (evento) => setCelular(evento.matches);
    setCelular(consulta.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  return celular;
}

/** Os itens do menu que existem para esta pessoa, na ordem certa. */
export function itensVisiveis(contexto, celular) {
  const disponiveis = ITENS_DOCK.filter((item) => !item.quando || item.quando(contexto));
  if (!celular) return disponiveis;

  const permitidas = TELAS_CELULAR[contexto.usuario?.papel] || [];
  return permitidas
    .map((caminho) => disponiveis.find((item) => item.para === caminho))
    .filter(Boolean);
}

/**
 * A rota pode ser aberta no celular?
 *
 * Compara por prefixo para as telas internas acompanharem a lista: quem
 * alcanca `/turmas` alcanca `/turmas/nova` e `/turmas/:id`.
 */
export function permitidoNoCelular(papel, caminho) {
  const combina = (base) => caminho === base || caminho.startsWith(`${base}/`);
  if (SEMPRE_ALCANCAVEIS.some(combina)) return true;
  return (TELAS_CELULAR[papel] || []).some(combina);
}

/**
 * Onde a pessoa cai ao entrar pelo celular, ou `null` quando o papel dela nao
 * tem nenhuma tela aqui — hoje professor e rh. `null` e resposta legitima e
 * precisa ser tratada: mandar essas pessoas para uma tela qualquer as deixaria
 * procurando o que sumiu.
 */
export function telaInicialNoCelular(contexto) {
  return itensVisiveis(contexto, true)[0]?.para || null;
}
