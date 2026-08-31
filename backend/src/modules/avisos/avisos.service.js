const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { publicarEvento } = require('../../realtime');
const notificacoesService = require('../responsaveis/notificacoes.service');

/**
 * Avisos gerais da escola (mural / comunicados), lidos pelos responsaveis
 * pelo app (ver responsaveis.service.avisosDoAluno). filial_id nulo = vale
 * pra empresa toda; preenchido = so aparece pros alunos daquela filial.
 */
async function validarAlvo(empresaId, { filial_id, turma_id }) {
  if (filial_id && turma_id) throw new AppError('Escolha uma unidade ou uma turma, nao os dois.', 400);
  if (filial_id) {
    const filial = await db('filiais').where({ id: filial_id, empresa_id: empresaId }).first();
    if (!filial) throw new AppError('Filial nao encontrada nesta empresa.', 404);
  }
  if (turma_id) {
    const turma = await db('turmas').where({ id: turma_id, empresa_id: empresaId }).first('id', 'filial_id');
    if (!turma) throw new AppError('Turma nao encontrada nesta empresa.', 404);
    return turma;
  }
  return null;
}

async function notificarAviso(empresaId, { filial_id, turma_id, titulo, mensagem }) {
  const query = db('responsavel_alunos as ra')
    .join('responsaveis as r', 'r.id', 'ra.responsavel_id')
    .join('alunos as a', 'a.id', 'ra.aluno_id')
    .join('push_tokens as pt', 'pt.responsavel_id', 'r.id')
    .where({ 'r.empresa_id': empresaId, 'r.ativo': true, 'a.empresa_id': empresaId, 'a.ativo': true })
    .distinct('pt.token');
  if (filial_id) query.where('a.filial_id', filial_id);
  if (turma_id) query.where('a.turma_id', turma_id);
  const tokens = await query;
  await Promise.all(tokens.map(({ token }) => notificacoesService.enviarPush({
    to: token,
    title: titulo,
    body: mensagem,
    data: { tipo: 'aviso.criado' },
  })));
}

async function criar(empresaId, { filial_id, turma_id, titulo, mensagem }) {
  if (!titulo || !titulo.trim()) throw new AppError('Titulo e obrigatorio.', 400);
  if (!mensagem || !mensagem.trim()) throw new AppError('Mensagem e obrigatoria.', 400);
  await validarAlvo(empresaId, { filial_id, turma_id });

  const [aviso] = await db('avisos_escola')
    .insert({ empresa_id: empresaId, filial_id: filial_id || null, turma_id: turma_id || null, titulo: titulo.trim(), mensagem: mensagem.trim() })
    .returning('*');

  publicarEvento('aviso.criado', { empresaId, filialId: filial_id || null });
  notificarAviso(empresaId, { filial_id, turma_id, titulo: aviso.titulo, mensagem: aviso.mensagem }).catch((err) => {
    console.error('[avisos] falha ao enviar push:', err.message);
  });

  return aviso;
}

async function listar(empresaId) {
  return db('avisos_escola as a')
    .select('a.id', 'a.titulo', 'a.mensagem', 'a.publicado_em', 'a.ativo', 'a.filial_id', 'a.turma_id', 'f.nome as filial_nome', 't.nome as turma_nome')
    .leftJoin('filiais as f', 'f.id', 'a.filial_id')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .where('a.empresa_id', empresaId)
    .orderBy('a.publicado_em', 'desc');
}

async function buscar(empresaId, id) {
  const aviso = await db('avisos_escola as a')
    .select('a.*', 'f.nome as filial_nome', 't.nome as turma_nome')
    .leftJoin('filiais as f', 'f.id', 'a.filial_id')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .where({ 'a.id': id, 'a.empresa_id': empresaId })
    .first();
  if (!aviso) throw new AppError('Aviso nao encontrado.', 404);
  return aviso;
}

async function atualizar(empresaId, id, dados) {
  const atual = await buscar(empresaId, id);
  const filial_id = dados.filial_id === undefined ? atual.filial_id : dados.filial_id;
  const turma_id = dados.turma_id === undefined ? atual.turma_id : dados.turma_id;
  const titulo = dados.titulo === undefined ? atual.titulo : String(dados.titulo || '').trim();
  const mensagem = dados.mensagem === undefined ? atual.mensagem : String(dados.mensagem || '').trim();
  if (!titulo) throw new AppError('Titulo e obrigatorio.', 400);
  if (!mensagem) throw new AppError('Mensagem e obrigatoria.', 400);
  await validarAlvo(empresaId, { filial_id, turma_id });
  const [aviso] = await db('avisos_escola').where({ id, empresa_id: empresaId }).update({ filial_id: filial_id || null, turma_id: turma_id || null, titulo, mensagem }).returning('*');
  publicarEvento('aviso.atualizado', { empresaId, avisoId: id });
  return aviso;
}

async function remover(empresaId, id) {
  const quantidade = await db('avisos_escola').where({ id, empresa_id: empresaId }).del();
  if (!quantidade) throw new AppError('Aviso nao encontrado.', 404);
  publicarEvento('aviso.removido', { empresaId, avisoId: id });
}

async function definirAtivo(empresaId, id, ativo) {
  const [aviso] = await db('avisos_escola')
    .where({ id, empresa_id: empresaId })
    .update({ ativo })
    .returning('*');
  if (!aviso) throw new AppError('Aviso nao encontrado.', 404);
  return aviso;
}

module.exports = { criar, listar, buscar, atualizar, remover, definirAtivo };
