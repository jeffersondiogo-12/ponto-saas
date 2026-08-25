const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { publicarEvento } = require('../../realtime');

/**
 * Avisos gerais da escola (mural / comunicados), lidos pelos responsaveis
 * pelo app (ver responsaveis.service.avisosDoAluno). filial_id nulo = vale
 * pra empresa toda; preenchido = so aparece pros alunos daquela filial.
 */
async function criar(empresaId, { filial_id, titulo, mensagem }) {
  if (!titulo || !titulo.trim()) throw new AppError('Titulo e obrigatorio.', 400);
  if (!mensagem || !mensagem.trim()) throw new AppError('Mensagem e obrigatoria.', 400);

  if (filial_id) {
    const filial = await db('filiais').where({ id: filial_id, empresa_id: empresaId }).first();
    if (!filial) throw new AppError('Filial nao encontrada nesta empresa.', 404);
  }

  const [aviso] = await db('avisos_escola')
    .insert({ empresa_id: empresaId, filial_id: filial_id || null, titulo: titulo.trim(), mensagem: mensagem.trim() })
    .returning('*');

  publicarEvento('aviso.criado', { empresaId, filialId: filial_id || null });

  return aviso;
}

async function listar(empresaId) {
  return db('avisos_escola as a')
    .select('a.id', 'a.titulo', 'a.mensagem', 'a.publicado_em', 'a.ativo', 'f.nome as filial_nome')
    .leftJoin('filiais as f', 'f.id', 'a.filial_id')
    .where('a.empresa_id', empresaId)
    .orderBy('a.publicado_em', 'desc');
}

async function definirAtivo(empresaId, id, ativo) {
  const [aviso] = await db('avisos_escola')
    .where({ id, empresa_id: empresaId })
    .update({ ativo })
    .returning('*');
  if (!aviso) throw new AppError('Aviso nao encontrado.', 404);
  return aviso;
}

module.exports = { criar, listar, definirAtivo };
