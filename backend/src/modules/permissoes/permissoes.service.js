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
const PAPEIS_ALCANCE_GERAL = [...PAPEIS];
const ALCANCE_RECURSOS = {
  usuarios: PAPEIS_ALCANCE_GERAL,
  empresas: PAPEIS_ALCANCE_GERAL,
  filiais: PAPEIS_ALCANCE_GERAL,
  funcionarios: PAPEIS_ALCANCE_GERAL,
  alunos: PAPEIS_ALCANCE_GERAL,
  responsaveis: PAPEIS_ALCANCE_GERAL,
  turmas: PAPEIS_ALCANCE_GERAL,
  dispositivos: PAPEIS_ALCANCE_GERAL,
  avisos: [...PAPEIS_GESTAO_AVISOS],
  auditoria: PAPEIS_ALCANCE_GERAL,
  ponto: PAPEIS_ALCANCE_GERAL,
  relatorios: PAPEIS_ALCANCE_GERAL,
  afd: PAPEIS_ALCANCE_GERAL,
  professores: ['professor', 'gestor', 'admin', 'super_admin'],
};

async function validarEscopo({ empresaId, filialId = null, atribuicaoId = null, papel = null, usuarioId = null }) {
  if (!empresaId) throw new AppError('Empresa e obrigatoria para configurar permissao.', 400);

  if (filialId) {
    const filial = await db('filiais').where({ id: filialId, empresa_id: empresaId }).first('id');
    if (!filial) throw new AppError('Filial nao pertence a empresa informada.', 400);
  }

  if (atribuicaoId) {
    const atribuicao = await db('turma_professores as tp')
      .join('turmas as t', 't.id', 'tp.turma_id')
      .where({ 'tp.id': atribuicaoId, 'tp.empresa_id': empresaId, 't.empresa_id': empresaId })
      .first('tp.id', 't.filial_id', 'tp.professor_id');
    if (!atribuicao) throw new AppError('Atribuicao nao pertence a empresa informada.', 400);
    if (filialId && String(atribuicao.filial_id) !== String(filialId)) {
      throw new AppError('Atribuicao nao pertence a filial informada.', 400);
    }
    if (papel && papel !== 'professor') {
      throw new AppError('Atribuicao so pode ser usada com o papel professor.', 400);
    }
    if (usuarioId && String(atribuicao.professor_id) !== String(usuarioId)) {
      throw new AppError('Atribuicao nao pertence ao usuario informado.', 400);
    }
  }
}

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

function listarAlcanceRecursos() {
  return Object.entries(ALCANCE_RECURSOS).map(([recurso, papeisPermitidos]) => ({
    recurso,
    papeisPermitidos,
  }));
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

async function listarPorPapel(papel, empresaId) {
  const consulta = db('permissoes_papeis')
    .select('recurso', 'acao')
    .where({ permitido: true });

  if (papel !== 'super_admin') consulta.where({ papel });
  if (empresaId) consulta.where({ empresa_id: empresaId });

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
async function listarMatrizPapeis(empresaId) {
  return db('permissoes_papeis')
    .select('empresa_id', 'filial_id', 'atribuicao_id', 'papel', 'recurso', 'acao', 'permitido')
    .where({ empresa_id: empresaId })
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
async function definirPermissaoPapel({ empresaId, filialId, atribuicaoId, papel, recurso, acao, permitido, auditoria }) {
  validarPermissao({ papel, recurso, acao, permitido });
  await validarEscopo({ empresaId, filialId, atribuicaoId, papel });

  const query = db('permissoes_papeis').where({ empresa_id: empresaId, papel, recurso, acao });
  filialId ? query.where({ filial_id: filialId }) : query.whereNull('filial_id');
  atribuicaoId ? query.where({ atribuicao_id: atribuicaoId }) : query.whereNull('atribuicao_id');
  const existente = await query.first('id');
  const dadosAntes = existente ? { permitido: existente.permitido } : null;
  if (existente) {
    await db('permissoes_papeis').where({ id: existente.id }).update({ permitido });
  } else {
    await db('permissoes_papeis').insert({ empresa_id: empresaId, filial_id: filialId || null, atribuicao_id: atribuicaoId || null, papel, recurso, acao, permitido });
  }
  if (auditoria?.usuarioId) {
    await db('auditoria_logs').insert({
      empresa_id: empresaId,
      usuario_id: auditoria.usuarioId,
      acao: 'alterar_permissao_papel',
      entidade: 'permissoes_papeis',
      entidade_id: existente?.id || `${empresaId}:${papel}:${recurso}:${acao}`,
      dados_antes: dadosAntes,
      dados_depois: { empresa_id: empresaId, filial_id: filialId || null, atribuicao_id: atribuicaoId || null, papel, recurso, acao, permitido },
      ip_origem: auditoria.ip,
    });
  }
}

/**
 * Permissao efetiva de UM usuario: comeca do padrao do cargo dele e, pra
 * cada recurso+acao onde existir uma excecao pessoal, sobrescreve com ela -
 * marcando "origem" pra tela saber o que e regra geral e o que foi
 * personalizado, e poder mostrar isso de forma diferente (ex: com um botao
 * "remover excecao").
 */
async function listarEfetivoPorUsuario(usuarioId, empresaId, filialId = null) {
  const usuario = await buscarUsuarioDaEmpresa(usuarioId, empresaId);
  const filialContexto = filialId || usuario.filial_id || null;

  const atribuicoes = await db('turma_professores')
    .where({ empresa_id: empresaId, professor_id: usuario.id, ativo: true })
    .pluck('id');

  const [padrao, excecoes] = await Promise.all([
    db('permissoes_papeis')
      .select('recurso', 'acao', 'permitido', 'filial_id', 'atribuicao_id')
      .where({ empresa_id: empresaId, papel: usuario.papel })
      .andWhere((scope) => scope.whereNull('filial_id').orWhere('filial_id', filialContexto))
      .andWhere((scope) => scope.whereNull('atribuicao_id').orWhereIn('atribuicao_id', atribuicoes)),
    db('permissoes_usuarios')
      .select('recurso', 'acao', 'permitido', 'filial_id', 'atribuicao_id')
      .where({ empresa_id: empresaId, usuario_id: usuarioId })
      .andWhere((scope) => scope.whereNull('filial_id').orWhere('filial_id', filialContexto))
      .andWhere((scope) => scope.whereNull('atribuicao_id').orWhereIn('atribuicao_id', atribuicoes)),
  ]);

  const efetivo = new Map();
  for (const linha of padrao) {
    if (!recursoAplicavelAoPapel(usuario.papel, linha.recurso)) continue;
    const chave = `${linha.recurso}:${linha.acao}`;
    const especificidade = (linha.filial_id ? 10 : 0) + (linha.atribuicao_id ? 20 : 0);
    const atual = efetivo.get(chave);
    if (atual && atual.especificidade >= especificidade) continue;
    efetivo.set(chave, {
      recurso: linha.recurso,
      acao: linha.acao,
      permitido: linha.permitido,
      origem: 'cargo',
      especificidade,
    });
  }
  for (const linha of excecoes) {
    if (!recursoAplicavelAoPapel(usuario.papel, linha.recurso)) continue;
    const chave = `${linha.recurso}:${linha.acao}`;
    const especificidade = 100 + (linha.filial_id ? 10 : 0) + (linha.atribuicao_id ? 20 : 0);
    const atual = efetivo.get(chave);
    if (atual && atual.especificidade >= especificidade) continue;
    efetivo.set(chave, {
      recurso: linha.recurso,
      acao: linha.acao,
      permitido: linha.permitido,
      origem: 'pessoal',
      especificidade,
    });
  }

  return [...efetivo.values()]
    .map(({ especificidade, ...linha }) => linha)
    .sort((a, b) => a.recurso.localeCompare(b.recurso));
}

/**
 * Cria/atualiza a excecao pessoal de um usuario pra um recurso+acao.
 */
async function definirOverrideUsuario({ usuarioId, empresaId, filialId, atribuicaoId, recurso, acao, permitido, auditoria }) {
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
  await validarEscopo({ empresaId, filialId, atribuicaoId, papel: usuario.papel, usuarioId });

  const query = db('permissoes_usuarios').where({ empresa_id: empresaId, usuario_id: usuarioId, recurso, acao });
  filialId ? query.where({ filial_id: filialId }) : query.whereNull('filial_id');
  atribuicaoId ? query.where({ atribuicao_id: atribuicaoId }) : query.whereNull('atribuicao_id');
  const existente = await query.first('id');
  const dadosAntes = existente ? { permitido: existente.permitido } : null;
  if (existente) {
    await db('permissoes_usuarios').where({ id: existente.id }).update({ permitido });
  } else {
    await db('permissoes_usuarios').insert({ empresa_id: empresaId, usuario_id: usuarioId, filial_id: filialId || null, atribuicao_id: atribuicaoId || null, recurso, acao, permitido });
  }
  if (auditoria?.usuarioId) {
    await db('auditoria_logs').insert({
      empresa_id: empresaId,
      usuario_id: auditoria.usuarioId,
      acao: 'alterar_override_permissao',
      entidade: 'permissoes_usuarios',
      entidade_id: existente?.id || `${empresaId}:${usuarioId}:${recurso}:${acao}`,
      dados_antes: dadosAntes,
      dados_depois: { empresa_id: empresaId, usuario_id: usuarioId, filial_id: filialId || null, atribuicao_id: atribuicaoId || null, recurso, acao, permitido },
      ip_origem: auditoria.ip,
    });
  }
}

/**
 * Remove a excecao pessoal - o usuario volta a seguir o padrao do cargo
 * dele nesse recurso+acao.
 */
async function removerOverrideUsuario({ usuarioId, empresaId, filialId, atribuicaoId, recurso, acao, auditoria }) {
  if (!RECURSOS.has(recurso)) {
    throw new AppError(`Recurso invalido: ${recurso}.`, 400);
  }
  if (!ACOES.includes(acao)) {
    throw new AppError(`Acao invalida: ${acao}.`, 400);
  }
  await buscarUsuarioDaEmpresa(usuarioId, empresaId);
  await validarEscopo({ empresaId, filialId, atribuicaoId, usuarioId });
  const query = db('permissoes_usuarios').where({
    empresa_id: empresaId,
    usuario_id: usuarioId,
    recurso,
    acao,
  });
  filialId ? query.where({ filial_id: filialId }) : query.whereNull('filial_id');
  atribuicaoId ? query.where({ atribuicao_id: atribuicaoId }) : query.whereNull('atribuicao_id');
  const existente = await query.first();
  if (!existente) return;
  await db('permissoes_usuarios').where({ id: existente.id }).del();
  if (auditoria?.usuarioId) {
    await db('auditoria_logs').insert({
      empresa_id: empresaId,
      usuario_id: auditoria.usuarioId,
      acao: 'remover_override_permissao',
      entidade: 'permissoes_usuarios',
      entidade_id: existente.id,
      dados_antes: existente,
      dados_depois: null,
      ip_origem: auditoria.ip,
    });
  }
}

/**
 * Mesmo resultado de listarEfetivoPorUsuario, mas agrupado no formato
 * {recurso, acoes: [...]} que o front ja consome hoje (so as permitidas) -
 * pra alimentar o proprio menu do usuario logado sem quebrar contrato.
 */
async function listarEfetivoAgrupado(usuarioId, empresaId, filialId = null) {
  const efetivo = await listarEfetivoPorUsuario(usuarioId, empresaId, filialId);

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

async function usuarioTemPermissao(usuarioId, empresaId, recurso, acao, filialId = null) {
  const permissoes = await listarEfetivoPorUsuario(usuarioId, empresaId, filialId);
  return permissoes.some((linha) => linha.recurso === recurso && linha.acao === acao && linha.permitido);
}

module.exports = {
  listarAlcanceRecursos,
  listarPorPapel,
  listarMatrizPapeis,
  definirPermissaoPapel,
  listarEfetivoPorUsuario,
  listarEfetivoAgrupado,
  usuarioTemPermissao,
  definirOverrideUsuario,
  removerOverrideUsuario,
};
