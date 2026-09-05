const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

const ACOES = ['ver', 'adicionar', 'atualizar', 'deletar'];

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
    if (ACOES.includes(linha.acao) && !agrupadas.get(linha.recurso).includes(linha.acao)) {
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
    .orderBy(['recurso', 'papel', 'acao']);
}

/**
 * Grava (ou atualiza) uma linha do padrao do cargo. Upsert porque a
 * combinacao papel+recurso+acao ja e unica na tabela - se a tela mandar uma
 * combinacao que ainda nao existe, cria; se ja existe, so atualiza o valor.
 */
async function definirPermissaoPapel({ papel, recurso, acao, permitido }) {
  if (!ACOES.includes(acao)) {
    throw new Error(`Acao invalida: ${acao}`);
  }

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
    efetivo.set(`${linha.recurso}:${linha.acao}`, {
      recurso: linha.recurso,
      acao: linha.acao,
      permitido: linha.permitido,
      origem: 'cargo',
    });
  }
  for (const linha of excecoes) {
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
  if (!ACOES.includes(acao)) {
    throw new Error(`Acao invalida: ${acao}`);
  }
  await buscarUsuarioDaEmpresa(usuarioId, empresaId);

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
  await buscarUsuarioDaEmpresa(usuarioId, empresaId);
  await db('permissoes_usuarios').where({ usuario_id: usuarioId, recurso, acao }).del();
}

module.exports = {
  listarPorPapel,
  listarMatrizPapeis,
  definirPermissaoPapel,
  listarEfetivoPorUsuario,
  definirOverrideUsuario,
  removerOverrideUsuario,
};
