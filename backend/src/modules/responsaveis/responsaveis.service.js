const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { publicarEvento } = require('../../realtime');

async function obterAlunoIdsVinculados(responsavelId) {
  const vinculos = await db('responsavel_alunos').where({ responsavel_id: responsavelId });
  return vinculos.map((v) => v.aluno_id);
}

async function buscarPorId(empresaId, responsavelId) {
  const responsavel = await db('responsaveis')
    .where({ id: responsavelId, empresa_id: empresaId })
    .first();

  if (!responsavel) throw new AppError('Responsavel nao encontrado.', 404);
  return responsavel;
}

async function login(email, senha) {
  const responsavel = await db('responsaveis').where({ email: email.toLowerCase().trim() }).first();

  if (!responsavel || !responsavel.ativo) {
    throw new AppError('Email ou senha invalidos.', 401);
  }

  const senhaOk = await bcrypt.compare(senha, responsavel.senha_hash);
  if (!senhaOk) {
    throw new AppError('Email ou senha invalidos.', 401);
  }

  await db('responsaveis').where({ id: responsavel.id }).update({ ultimo_login_em: db.fn.now() });

  const alunoIds = await obterAlunoIdsVinculados(responsavel.id);

  const payload = {
    tipo: 'responsavel',
    id: responsavel.id,
    responsavelId: responsavel.id,
    empresa_id: responsavel.empresa_id,
    nome: responsavel.nome,
    email: responsavel.email,
    alunoIds,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  return { token, responsavel: payload };
}

/**
 * Cadastro do responsavel + vinculo inicial com um aluno pela matricula (o
 * jeito mais simples de uma escola "convidar" um pai: dar a matricula do
 * filho, o proprio pai confirma o vinculo ao criar a conta).
 */
async function cadastrar({ empresa_id, nome, email, senha, telefone, matricula_aluno }) {
  const existente = await db('responsaveis').where({ email: email.toLowerCase().trim() }).first();
  if (existente) throw new AppError('Ja existe uma conta com este email.', 409);

  const aluno = await db('alunos').where({ empresa_id, matricula: matricula_aluno }).first();
  if (!aluno) throw new AppError('Matricula de aluno nao encontrada.', 404);

  const senha_hash = await bcrypt.hash(senha, 12);

  return db.transaction(async (trx) => {
    const [responsavel] = await trx('responsaveis')
      .insert({ empresa_id, nome, email: email.toLowerCase().trim(), senha_hash, telefone: telefone || null })
      .returning('*');

    await trx('responsavel_alunos').insert({ responsavel_id: responsavel.id, aluno_id: aluno.id });

    return responsavel;
  });
}

async function vincularAluno(empresaId, responsavelId, matriculaAluno, parentesco) {
  const responsavel = await db('responsaveis').where({ id: responsavelId, empresa_id: empresaId }).first();
  if (!responsavel) throw new AppError('Responsavel nao encontrado.', 404);

  const aluno = await db('alunos').where({ empresa_id: empresaId, matricula: matriculaAluno }).first();
  if (!aluno) throw new AppError('Matricula de aluno nao encontrada.', 404);

  const [vinculo] = await db('responsavel_alunos')
    .insert({ responsavel_id: responsavelId, aluno_id: aluno.id, parentesco: parentesco || null })
    .onConflict(['responsavel_id', 'aluno_id'])
    .merge({ parentesco: parentesco || null })
    .returning('*');

  return vinculo;
}

function normalizarCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

async function vincularFilhoDoResponsavel(responsavelId, { nome_completo, cpf, matricula_aluno, parentesco }) {
  const responsavel = await db('responsaveis').where({ id: responsavelId }).first();
  if (!responsavel) throw new AppError('Responsavel nao encontrado.', 404);

  const cpfNormalizado = normalizarCpf(cpf);
  if (!nome_completo || cpfNormalizado.length !== 11 || !matricula_aluno) {
    throw new AppError('Informe nome completo, CPF e matricula do aluno.', 400);
  }

  const aluno = await db('alunos')
    .where({ empresa_id: responsavel.empresa_id, matricula: String(matricula_aluno).trim(), cpf: cpfNormalizado, ativo: true })
    .whereRaw('LOWER(TRIM(nome)) = LOWER(TRIM(?))', [nome_completo])
    .first();
  if (!aluno) throw new AppError('Nao encontramos um aluno com esses dados. Confira com a secretaria.', 404);

  const [vinculo] = await db('responsavel_alunos')
    .insert({ responsavel_id: responsavelId, aluno_id: aluno.id, parentesco: parentesco || null })
    .onConflict(['responsavel_id', 'aluno_id'])
    .merge({ parentesco: parentesco || null })
    .returning('*');

  return { vinculo, aluno };
}

async function listarAlunosVinculados(alunoIds) {
  if (!alunoIds || alunoIds.length === 0) return [];

  return db('alunos as a')
    .select('a.id', 'a.nome', 'a.matricula', 't.nome as turma_nome', 'f.nome as filial_nome')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .join('filiais as f', 'f.id', 'a.filial_id')
    .whereIn('a.id', alunoIds);
}

async function frequenciaDoAluno(alunoIdsPermitidos, alunoId, { de, ate } = {}) {
  if (!alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }

  const query = db('registros_ponto')
    .select('data_hora', 'origem')
    .where({ aluno_id: alunoId })
    .orderBy('data_hora', 'desc');

  if (de) query.where('data_hora', '>=', de);
  if (ate) query.where('data_hora', '<=', ate);

  return query;
}

async function painelDoAluno(alunoIdsPermitidos, alunoId) {
  if (!alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }

  const aluno = await db('alunos as a')
    .select('a.id', 'a.nome', 'a.matricula', 't.nome as turma_nome', 'a.filial_id', 'a.empresa_id')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .where('a.id', alunoId)
    .first();
  if (!aluno) throw new AppError('Aluno nao encontrado.', 404);

  const [presenca, notas, observacoes, avisos] = await Promise.all([
    frequenciaDoAluno(alunoIdsPermitidos, alunoId),
    db('notas_alunos').where({ aluno_id: alunoId }).select('id', 'disciplina', 'etapa', 'nota', 'observacao').orderBy('etapa').orderBy('disciplina'),
    db('observacoes_alunos').where({ aluno_id: alunoId }).select('id', 'titulo', 'texto', 'autor_nome', 'created_at').orderBy('created_at', 'desc'),
    db('avisos_escola').where({ empresa_id: aluno.empresa_id, ativo: true }).where(function () {
      this.whereNull('filial_id').orWhere('filial_id', aluno.filial_id);
    }).select('id', 'titulo', 'mensagem', 'publicado_em').orderBy('publicado_em', 'desc'),
  ]);

  return { aluno, presenca, notas, observacoes, avisos };
}

async function criarNota(empresaId, dados) {
  await validarAlunoDaEmpresa(empresaId, dados.aluno_id);
  const [nota] = await db('notas_alunos').insert({ ...dados, empresa_id: empresaId }).returning('*');
  publicarEvento('nota.criada', { empresaId, alunoId: dados.aluno_id });
  return nota;
}

async function criarObservacao(empresaId, dados) {
  await validarAlunoDaEmpresa(empresaId, dados.aluno_id);
  const [observacao] = await db('observacoes_alunos').insert({ ...dados, empresa_id: empresaId }).returning('*');
  publicarEvento('observacao.criada', { empresaId, alunoId: dados.aluno_id });
  return observacao;
}

async function criarAviso(empresaId, dados) {
  if (dados.filial_id) {
    const filial = await db('filiais').where({ id: dados.filial_id, empresa_id: empresaId }).first();
    if (!filial) throw new AppError('Unidade nao encontrada.', 404);
  }
  const [aviso] = await db('avisos_escola').insert({ ...dados, empresa_id: empresaId }).returning('*');
  publicarEvento('aviso.criado', { empresaId, filialId: dados.filial_id || null });
  return aviso;
}

async function validarAlunoDaEmpresa(empresaId, alunoId) {
  const aluno = await db('alunos').where({ id: alunoId, empresa_id: empresaId }).first();
  if (!aluno) throw new AppError('Aluno nao encontrado.', 404);
}

async function registrarPushToken(responsavelId, token, plataforma) {
  const [registro] = await db('push_tokens')
    .insert({ responsavel_id: responsavelId, token, plataforma })
    .onConflict(['token'])
    .merge({ responsavel_id: responsavelId, plataforma })
    .returning('*');

  return registro;
}

async function excluir(empresaId, responsavelId) {
  const responsavel = await buscarPorId(empresaId, responsavelId);

  await db('responsaveis').where({ id: responsavelId, empresa_id: empresaId }).del();

  return responsavel;
}

module.exports = {
  login,
  cadastrar,
  vincularAluno,
  vincularFilhoDoResponsavel,
  listarAlunosVinculados,
  frequenciaDoAluno,
  painelDoAluno,
  criarNota,
  criarObservacao,
  criarAviso,
  registrarPushToken,
  obterAlunoIdsVinculados,
  buscarPorId,
  excluir,
};
