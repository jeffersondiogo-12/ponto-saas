const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

const ACOES = ['ver', 'adicionar', 'atualizar', 'deletar'];
const PAPEIS = ['super_admin', 'admin', 'rh', 'gestor', 'professor'];
const RECURSOS = new Set([
  'usuarios',
  'empresas',
  'filiais',
  'funcionarios',
  'alunos',
  'responsaveis',
  'turmas',
  'dispositivos',
  'avisos',
  'auditoria',
  'ponto',
  'relatorios',
  'afd',
  'professores',
]);
const PAPEIS_GESTAO_AVISOS = new Set(['admin', 'gestor', 'super_admin']);

function validarPermissao({ papel, recurso, acao, permitido }) {
  if (!PAPEIS.includes(papel)) {
    throw new AppError(`Papel invalido: ${papel}.`, 400);
  }
  if (!RECURSOS.has(recurso)) {
    throw new AppError(`Recurso invalido: ${recurso}.`, 400);
  }
  if (!ACOES.includes(acao)) {
    throw new AppError(`Acao invalida: ${acao}.`, 400);
  }
  if (typeof permitido !== 'boolean') {
    throw new AppError('O campo permitido deve ser booleano.', 400);
  }
  if (recurso === 'avisos' && !PAPEIS_GESTAO_AVISOS.has(papel)) {
    throw new AppError(`O papel ${papel} nao pode administrar avisos.`, 400);
  }
}

function recursoAplicavelAoPapel(papel, recurso) {
  return recurso !== 'avisos' || PAPEIS_GESTAO_AVISOS.has(papel);
}

/**
 * Confere que o usuario-alvo pertence a empresa que o super_admin esta
 * operando no momento (X-Empresa-Id) - evita mexer no usuario errado por
 * engano so porque o ID foi digitado certo mas o header estava trocado.
 */
async function buscarUsuarioDaEmpresa(usuarioId, empresaId) {
  const usuario = await db('usuarios')
    .select('id', 'papel', 'empresa_id')
    .where({ id: usuarioId, empresa_id: empresaId })
    .first();

  if (!usuario) {
    throw new AppError('Usuario nao encontrado nesta empresa.', 404);
  }
  return usuario;
}

async function listarPorPapel(papel) {
  const consulta = db('permissoes_papeis')
    .select('recurso', 'acao')
    .where({ permitido: true });

  if (papel !== 'super_admin') consulta.where({ papel });

  const linhas = await consulta.orderBy('recurso');

  const agrupadas = new Map();
  for (const linha of linhas) {
    if (!agrupadas.has(linha.recurso)) agrupadas.set(linha.recurso, []);
    if (recursoAplicavelAoPapel(papel, linha.recurso)
      && ACOES.includes(linha.acao)
      && !agrupadas.get(linha.recurso).includes(linha.acao)) {
      agrupadas.get(linha.recurso).push(linha.acao);
    }
  }

  return [...agrupadas.entries()]
    .map(([recurso, acoes]) => ({
      recurso,
      acoes: ACOES.filter((acao) => acoes.includes(acao)),
    }))
    .filter((item) => item.acoes.length > 0);
}

/**
 * Matriz completa: toda linha de permissoes_papeis, pra montar a tela geral
 * do super_admin (uma tabela cargo x recurso x acao com checkboxes).
 */
async function listarMatrizPapeis() {
  return db('permissoes_papeis')
    .select('papel', 'recurso', 'acao', 'permitido')
    .where(function recursosAplicaveis() {
      this.whereNot('recurso', 'avisos').orWhereIn('papel', [...PAPEIS_GESTAO_AVISOS]);
    })
    .orderBy(['recurso', 'papel', 'acao']);
}

/**
 * Grava (ou atualiza) uma linha do padrao do cargo. Upsert porque a
 * combinacao papel+recurso+acao ja e unica na tabela - se a tela mandar uma
 * combinacao que ainda nao existe, cria; se ja existe, so atualiza o valor.
 */
async function definirPermissaoPapel({ papel, recurso, acao, permitido }) {
  validarPermissao({ papel, recurso, acao, permitido });

  await db('permissoes_papeis')
    .insert({ papel, recurso, acao, permitido })
    .onConflict(['papel', 'recurso', 'acao'])
    .merge(['permitido']);
}

/**
 * Permissao efetiva de UM usuario: comeca do padrao do cargo dele e, pra
 * cada recurso+acao onde existir uma excecao pessoal, sobrescreve com ela -
 * marcando "origem" pra tela saber o que e regra geral e o que foi
 * personalizado, e poder mostrar isso de forma diferente (ex: com um botao
 * "remover excecao").
 */
async function listarEfetivoPorUsuario(usuarioId, empresaId) {
  const usuario = await buscarUsuarioDaEmpresa(usuarioId, empresaId);

  const [padrao, excecoes] = await Promise.all([
    db('permissoes_papeis').select('recurso', 'acao', 'permitido').where({ papel: usuario.papel }),
    db('permissoes_usuarios').select('recurso', 'acao', 'permitido').where({ usuario_id: usuarioId }),
  ]);

  const efetivo = new Map();
  for (const linha of padrao) {
    if (!recursoAplicavelAoPapel(usuario.papel, linha.recurso)) continue;
    efetivo.set(`${linha.recurso}:${linha.acao}`, {
      recurso: linha.recurso,
      acao: linha.acao,
      permitido: linha.permitido,
      origem: 'cargo',
    });
  }
  for (const linha of excecoes) {
    if (!recursoAplicavelAoPapel(usuario.papel, linha.recurso)) continue;
    efetivo.set(`${linha.recurso}:${linha.acao}`, {
      recurso: linha.recurso,
      acao: linha.acao,
      permitido: linha.permitido,
      origem: 'pessoal',
    });
  }

  return [...efetivo.values()].sort((a, b) => a.recurso.localeCompare(b.recurso));
}

/**
 * Cria/atualiza a excecao pessoal de um usuario pra um recurso+acao.
 */
async function definirOverrideUsuario({ usuarioId, empresaId, recurso, acao, permitido }) {
  if (!RECURSOS.has(recurso)) {
    throw new AppError(`Recurso invalido: ${recurso}.`, 400);
  }
  if (!ACOES.includes(acao)) {
    throw new AppError(`Acao invalida: ${acao}.`, 400);
  }
  if (typeof permitido !== 'boolean') {
    throw new AppError('O campo permitido deve ser booleano.', 400);
  }
  const usuario = await buscarUsuarioDaEmpresa(usuarioId, empresaId);
  if (!recursoAplicavelAoPapel(usuario.papel, recurso)) {
    throw new AppError(`O papel ${usuario.papel} nao pode administrar avisos.`, 400);
  }

  await db('permissoes_usuarios')
    .insert({ usuario_id: usuarioId, recurso, acao, permitido })
    .onConflict(['usuario_id', 'recurso', 'acao'])
    .merge(['permitido']);
}

/**
 * Remove a excecao pessoal - o usuario volta a seguir o padrao do cargo
 * dele nesse recurso+acao.
 */
async function removerOverrideUsuario({ usuarioId, empresaId, recurso, acao }) {
  if (!RECURSOS.has(recurso)) {
    throw new AppError(`Recurso invalido: ${recurso}.`, 400);
  }
  if (!ACOES.includes(acao)) {
    throw new AppError(`Acao invalida: ${acao}.`, 400);
  }
  await buscarUsuarioDaEmpresa(usuarioId, empresaId);
  await db('permissoes_usuarios').where({ usuario_id: usuarioId, recurso, acao }).del();
}

/**
 * Mesmo resultado de listarEfetivoPorUsuario, mas agrupado no formato
 * {recurso, acoes: [...]} que o front ja consome hoje (so as permitidas) -
 * pra alimentar o proprio menu do usuario logado sem quebrar contrato.
 */
async function listarEfetivoAgrupado(usuarioId, empresaId) {
  const efetivo = await listarEfetivoPorUsuario(usuarioId, empresaId);

  const agrupadas = new Map();
  for (const linha of efetivo) {
    if (!linha.permitido) continue;
    if (!agrupadas.has(linha.recurso)) agrupadas.set(linha.recurso, []);
    if (!agrupadas.get(linha.recurso).includes(linha.acao)) {
      agrupadas.get(linha.recurso).push(linha.acao);
    }
  }

  return [...agrupadas.entries()]
    .map(([recurso, acoes]) => ({
      recurso,
      acoes: ACOES.filter((acao) => acoes.includes(acao)),
    }))
    .filter((item) => item.acoes.length > 0);
}

module.exports = {
  listarPorPapel,
  listarMatrizPapeis,
  definirPermissaoPapel,
  listarEfetivoPorUsuario,
  listarEfetivoAgrupado,
  definirOverrideUsuario,
  removerOverrideUsuario,
};
