const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function listar(empresaId, { turmaId, ativo } = {}) {
  const query = db('alunos as a')
    .select('a.*', 't.nome as turma_nome', 'f.nome as filial_nome')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .join('filiais as f', 'f.id', 'a.filial_id')
    .where('a.empresa_id', empresaId)
    .orderBy('a.nome');

  if (turmaId) query.where('a.turma_id', turmaId);
  if (ativo !== undefined) query.where('a.ativo', ativo);

  return query;
}

async function buscarPorId(empresaId, alunoId) {
  const aluno = await db('alunos').where({ id: alunoId, empresa_id: empresaId }).first();
  if (!aluno) throw new AppError('Aluno nao encontrado.', 404);
  return aluno;
}

async function criar(empresaId, dados) {
  const filial = await db('filiais').where({ id: dados.filial_id, empresa_id: empresaId }).first();
  if (!filial) throw new AppError('Unidade nao encontrada.', 404);
  if (filial.tipo !== 'escola') {
    throw new AppError('Alunos só podem ser cadastrados em unidades do tipo escola.', 400);
  }

  const matriculaExistente = await db('alunos')
    .where({ empresa_id: empresaId, matricula: dados.matricula })
    .first();
  if (matriculaExistente) throw new AppError('Já existe um aluno com esta matrícula.', 409);

  const [aluno] = await db('alunos')
    .insert({
      empresa_id: empresaId,
      filial_id: dados.filial_id,
      turma_id: dados.turma_id || null,
      matricula: dados.matricula,
      nome: dados.nome,
      data_nascimento: dados.data_nascimento || null,
      nome_responsavel: dados.nome_responsavel || null,
      contato_responsavel: dados.contato_responsavel || null,
    })
    .returning('*');

  return aluno;
}

async function atualizar(empresaId, alunoId, dados) {
  await buscarPorId(empresaId, alunoId);

  const [aluno] = await db('alunos')
    .where({ id: alunoId, empresa_id: empresaId })
    .update({
      turma_id: dados.turma_id || null,
      nome: dados.nome,
      data_nascimento: dados.data_nascimento || null,
      nome_responsavel: dados.nome_responsavel || null,
      contato_responsavel: dados.contato_responsavel || null,
      ativo: dados.ativo !== undefined ? dados.ativo : true,
    })
    .returning('*');

  return aluno;
}

/**
 * Vincula o aluno a um dispositivo, informando o ID interno que o proprio
 * equipamento usa para essa pessoa - mesmo mecanismo usado para funcionarios
 * (funcionario_dispositivos), so que numa tabela separada porque um aluno e
 * um funcionario sao cadastros diferentes.
 */
async function vincularDispositivo(empresaId, alunoId, dispositivoId, idNoDispositivo) {
  await buscarPorId(empresaId, alunoId);

  const dispositivo = await db('dispositivos').where({ id: dispositivoId, empresa_id: empresaId }).first();
  if (!dispositivo) throw new AppError('Dispositivo nao encontrado.', 404);

  // Um mesmo ID interno do dispositivo nao pode already estar reservado por
  // um FUNCIONARIO (o equipamento nao distingue "tipo de pessoa" nos IDs dele).
  const colisaoComFuncionario = await db('funcionario_dispositivos')
    .where({ dispositivo_id: dispositivoId, id_no_dispositivo: String(idNoDispositivo) })
    .first();
  if (colisaoComFuncionario) {
    throw new AppError('Este ID já está em uso por um funcionário cadastrado neste dispositivo.', 409);
  }

  const [vinculo] = await db('aluno_dispositivos')
    .insert({ aluno_id: alunoId, dispositivo_id: dispositivoId, id_no_dispositivo: String(idNoDispositivo) })
    .onConflict(['aluno_id', 'dispositivo_id'])
    .merge({ id_no_dispositivo: String(idNoDispositivo) })
    .returning('*');

  return vinculo;
}

/**
 * Frequencia simples: so lista as batidas (chegada/saida) do periodo, sem
 * calculo de atraso/banco de horas - isso nao se aplica a alunos, so a
 * funcionarios sob CLT (ver README).
 */
async function frequencia(empresaId, alunoId, { de, ate } = {}) {
  await buscarPorId(empresaId, alunoId);

  const query = db('registros_ponto')
    .select('data_hora', 'origem')
    .where({ empresa_id: empresaId, aluno_id: alunoId })
    .orderBy('data_hora', 'desc');

  if (de) query.where('data_hora', '>=', de);
  if (ate) query.where('data_hora', '<=', ate);

  return query;
}

module.exports = { listar, buscarPorId, criar, atualizar, vincularDispositivo, frequencia };
