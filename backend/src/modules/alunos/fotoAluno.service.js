const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { encryptFaceQueueData, decryptFaceQueueData } = require('../../utils/crypto');
const { normalizarFoto } = require('../dispositivos/faceSync.service');

/**
 * Foto do aluno guardada no sistema (`fotos_alunos`), cifrada com a mesma
 * chave derivada da fila de faces. E a imagem que a tela mostra e que o envio
 * em lote manda ao equipamento (faceSync.enviarAlunosSalvos).
 *
 * So JPEG: o equipamento recebe a imagem como ela vem. O web ja manda JPEG,
 * reduzido e sem metadados (web/src/utils/fotoAluno.js); aqui e a trava do
 * lado do servidor para nada diferente entrar.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSINATURA_JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const ehJpeg = (base64) => Buffer.from(base64.slice(0, 8), 'base64').subarray(0, 3).equals(ASSINATURA_JPEG);

async function conferirAluno(empresaId, alunoId, filialId) {
  if (typeof alunoId !== 'string' || !UUID.test(alunoId)) throw new AppError('Aluno nao encontrado.', 404);
  const aluno = await db('alunos').where({ id: alunoId, empresa_id: empresaId }).first('id', 'filial_id');
  if (!aluno || (filialId && aluno.filial_id !== filialId)) {
    throw new AppError('Aluno nao encontrado.', 404);
  }
}

const registrar = (trx, empresaId, usuarioId, acao, alunoId) =>
  trx('auditoria_logs').insert({
    empresa_id: empresaId,
    usuario_id: usuarioId,
    acao,
    entidade: 'alunos',
    entidade_id: alunoId,
  });

async function salvar(empresaId, alunoId, fotoBase64, { usuarioId = null, filialId = null } = {}) {
  await conferirAluno(empresaId, alunoId, filialId);
  const foto = normalizarFoto(fotoBase64);
  if (!ehJpeg(foto)) throw new AppError('A foto precisa estar em JPEG.', 400);
  const fotoCifrada = encryptFaceQueueData(foto);

  await db.transaction(async (trx) => {
    await trx('fotos_alunos')
      .insert({ aluno_id: alunoId, empresa_id: empresaId, foto_cifrada: fotoCifrada })
      .onConflict('aluno_id')
      .merge({ foto_cifrada: fotoCifrada, updated_at: db.fn.now() });
    await registrar(trx, empresaId, usuarioId, 'salvar_foto_aluno', alunoId);
  });
}

/** A foto em Base64, para o envio ao equipamento. Sem foto: 404 com o motivo. */
async function lerBase64(empresaId, alunoId) {
  if (typeof alunoId !== 'string' || !UUID.test(alunoId)) throw new AppError('Aluno nao encontrado.', 404);
  const linha = await db('fotos_alunos').where({ aluno_id: alunoId, empresa_id: empresaId }).first('foto_cifrada');
  if (!linha) throw new AppError('Aluno sem foto cadastrada.', 404);
  return decryptFaceQueueData(linha.foto_cifrada);
}

/** A foto em bytes, para a tela. */
async function ler(empresaId, alunoId, filialId = null) {
  await conferirAluno(empresaId, alunoId, filialId);
  return Buffer.from(await lerBase64(empresaId, alunoId), 'base64');
}

async function remover(empresaId, alunoId, { usuarioId = null, filialId = null } = {}) {
  await conferirAluno(empresaId, alunoId, filialId);
  await db.transaction(async (trx) => {
    const removidas = await trx('fotos_alunos').where({ aluno_id: alunoId, empresa_id: empresaId }).del();
    if (!removidas) throw new AppError('Aluno sem foto cadastrada.', 404);
    await registrar(trx, empresaId, usuarioId, 'remover_foto_aluno', alunoId);
  });
}

module.exports = { salvar, ler, lerBase64, remover };
