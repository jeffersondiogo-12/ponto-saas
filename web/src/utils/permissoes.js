/**
 * Decisao de interface: o que MOSTRAR para cada usuario.
 *
 * A matriz mora no banco (`permissoes_papeis`) e chega por `GET /api/permissoes`
 * ja recortada pelo papel de quem esta logado. **Nao duplique a matriz aqui** —
 * foi para tirar essa regra do codigo que ela foi para o banco. Mudar quem pode
 * o que passou a ser um UPDATE, sem deploy, e o front so obedece.
 *
 * Isto NAO e seguranca. Quem autoriza e o backend, com `exigirPermissao` em
 * cada rota. Aqui a gente so evita oferecer um botao que renderia 403.
 */

export const ACOES = ['ver', 'adicionar', 'atualizar', 'deletar'];

/** `[{ recurso, acoes: [...] }]` vira `{ recurso: Set(acoes) }`, para consulta O(1). */
export function normalizarPermissoes(lista = []) {
  const mapa = {};
  for (const item of lista) {
    if (!item?.recurso) continue;
    mapa[item.recurso] = new Set(item.acoes || []);
  }
  return mapa;
}

export function ehSuperAdmin(usuario) {
  return usuario?.papel === 'super_admin';
}

/**
 * `super_admin` passa direto, espelhando o middleware do servidor
 * (`permissions.js` devolve `next()` antes de consultar a tabela).
 *
 * Isso tambem resolve um problema de ordem: `/api/permissoes` passa por
 * `resolverTenant`, que exige `X-Empresa-Id` — e o super_admin so escolhe a
 * empresa DEPOIS de entrar. Sem este atalho, ele ficaria sem menu nenhum entre
 * o login e a escolha da empresa.
 */
export function pode(usuario, permissoes, recurso, acao) {
  if (ehSuperAdmin(usuario)) return true;
  if (!recurso || !acao) return false;
  return Boolean(permissoes?.[recurso]?.has(acao));
}

/**
 * Quais papeis cada um pode CRIAR. Espelha `auth.service.criarUsuario`:
 * super_admin cria os cinco; admin cria gestor, professor e rh — nao cria
 * outro admin.
 *
 * Esta regra NAO esta na matriz de permissoes: a matriz diz se voce pode
 * "adicionar usuario", nao QUAL papel pode atribuir. Por isso continua
 * espelhada em codigo, e precisa ser conferida contra o backend quando ele
 * mudar — se divergir, a tela oferece um papel que leva 403 no envio.
 */
export function papeisCriaveis(papelDoCriador) {
  if (papelDoCriador === 'super_admin') return ['super_admin', 'admin', 'gestor', 'professor', 'rh'];
  if (papelDoCriador === 'admin') return ['gestor', 'professor', 'rh'];
  return [];
}

/**
 * Dicionario de ROTULOS, nao a lista de recursos.
 *
 * Quem manda no que aparece na tela e a API — `GET /api/permissoes/papeis`
 * devolve os recursos que existem no banco, e essa lista cresce conforme o
 * sistema ganha telas. Fixar os recursos aqui faria recurso novo ficar
 * invisivel ate alguem lembrar de atualizar o front.
 *
 * Este mapa serve so para traduzir a chave crua num nome legivel
 * (`professores` -> "Sala de aula"). Chave sem traducao aparece como veio,
 * que e feio mas honesto — melhor do que sumir da tela.
 */
const ROTULO_RECURSO = {
  usuarios: 'Usuários',
  empresas: 'Empresas',
  filiais: 'Unidades',
  funcionarios: 'Funcionários',
  alunos: 'Alunos',
  responsaveis: 'Responsáveis',
  turmas: 'Turmas',
  dispositivos: 'Dispositivos',
  avisos: 'Avisos',
  auditoria: 'Auditoria',
  ponto: 'Ponto',
  relatorios: 'Relatórios',
  afd: 'AFD',
  professores: 'Sala de aula',
};

export const rotuloRecurso = (chave) => ROTULO_RECURSO[chave] || chave;

/** As 4 acoes sao fixas no backend — o documento e explicito nisso. */
export const ROTULO_ACAO = {
  ver: 'Ver',
  adicionar: 'Criar',
  atualizar: 'Editar',
  deletar: 'Excluir',
};
