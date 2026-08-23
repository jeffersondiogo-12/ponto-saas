const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function listar(empresaId, { ativo } = {}) {
  const query = db('funcionarios as f')
    .select(
      'f.*',
      'd.nome as departamento_nome',
      'h.nome as horario_nome',
      'fi.nome as filial_nome'
    )
    .leftJoin('departamentos as d', 'd.id', 'f.departamento_id')
    .leftJoin('horarios_trabalho as h', 'h.id', 'f.horario_trabalho_id')
    .leftJoin('filiais as fi', 'fi.id', 'f.filial_id')
    .where('f.empresa_id', empresaId)
    .orderBy('f.nome');

  if (ativo !== undefined) {
    query.where('f.ativo', ativo);
  }

  return query;
}

async function buscarPorId(empresaId, funcionarioId) {
  const funcionario = await db('funcionarios')
    .where({ id: funcionarioId, empresa_id: empresaId })
    .first();

  if (!funcionario) throw new AppError('Funcionario nao encontrado.', 404);
  return funcionario;
}

async function criar(empresaId, dados) {
  const cpfExistente = await db('funcionarios')
    .where({ empresa_id: empresaId, cpf: dados.cpf })
    .first();
  if (cpfExistente) throw new AppError('Ja existe um funcionario com este CPF nesta empresa.', 409);

  const matriculaExistente = await db('funcionarios')
    .where({ empresa_id: empresaId, matricula: dados.matricula })
    .first();
  if (matriculaExistente) throw new AppError('Ja existe um funcionario com esta matricula.', 409);

  const [funcionario] = await db('funcionarios')
    .insert({
      empresa_id: empresaId,
      filial_id: dados.filial_id || null,
      departamento_id: dados.departamento_id || null,
      horario_trabalho_id: dados.horario_trabalho_id || null,
      matricula: dados.matricula,
      nome: dados.nome,
      cpf: dados.cpf,
      pis: dados.pis || null,
      cargo: dados.cargo || null,
      data_admissao: dados.data_admissao,
    })
    .returning('*');

  return funcionario;
}

async function atualizar(empresaId, funcionarioId, dados) {
  await buscarPorId(empresaId, funcionarioId);

  const [funcionario] = await db('funcionarios')
    .where({ id: funcionarioId, empresa_id: empresaId })
    .update({
      filial_id: dados.filial_id || null,
      departamento_id: dados.departamento_id || null,
      horario_trabalho_id: dados.horario_trabalho_id || null,
      nome: dados.nome,
      cargo: dados.cargo || null,
      pis: dados.pis || null,
      data_demissao: dados.data_demissao || null,
      ativo: dados.ativo !== undefined ? dados.ativo : true,
    })
    .returning('*');

  return funcionario;
}

/**
 * Vincula o funcionario a um dispositivo, informando qual ID interno o
 * proprio relogio usa para essa pessoa (necessario para resolver as batidas
 * brutas recebidas na coleta).
 */
async function vincularDispositivo(empresaId, funcionarioId, dispositivoId, idNoDispositivo) {
  await buscarPorId(empresaId, funcionarioId);

  const dispositivo = await db('dispositivos')
    .where({ id: dispositivoId, empresa_id: empresaId })
    .first();
  if (!dispositivo) throw new AppError('Dispositivo nao encontrado.', 404);

  const [vinculo] = await db('funcionario_dispositivos')
    .insert({
      funcionario_id: funcionarioId,
      dispositivo_id: dispositivoId,
      id_no_dispositivo: String(idNoDispositivo),
    })
    .onConflict(['funcionario_id', 'dispositivo_id'])
    .merge({ id_no_dispositivo: String(idNoDispositivo) })
    .returning('*');

  return vinculo;
}

module.exports = { listar, buscarPorId, criar, atualizar, vincularDispositivo };
