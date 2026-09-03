const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

function normalizarDadosDeAcesso(dados = {}) {
  const nome = String(dados.nome || '').trim();
  const email = String(dados.email || '').trim().toLowerCase();
  const senha = String(dados.senha || '');
  const telefone = String(dados.telefone || '').trim() || null;
  const parentesco = String(dados.parentesco || '').trim() || null;

  if (!nome) throw new AppError('Informe o nome do responsavel.', 400);
  if (nome.length > 150) throw new AppError('O nome do responsavel deve ter no maximo 150 caracteres.', 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Informe um email valido para o responsavel.', 400);
  }
  if (email.length > 150) throw new AppError('O email do responsavel deve ter no maximo 150 caracteres.', 400);
  if (senha.length < 8) throw new AppError('A senha do responsavel deve ter no minimo 8 caracteres.', 400);
  if (telefone && telefone.length > 20) {
    throw new AppError('O telefone do responsavel deve ter no maximo 20 caracteres.', 400);
  }
  if (parentesco && parentesco.length > 40) {
    throw new AppError('O parentesco deve ter no maximo 40 caracteres.', 400);
  }

  return { nome, email, senha, telefone, parentesco };
}

/**
 * Cria o acesso do responsavel ou reutiliza uma conta da mesma empresa e
 * garante o vinculo com o aluno. A transacao vem do chamador para que aluno,
 * conta e vinculo sejam confirmados ou revertidos juntos.
 */
async function criarOuVincularAoAluno(trx, empresaId, alunoId, dados) {
  const responsavelDados = normalizarDadosDeAcesso(dados);
  let responsavel = await trx('responsaveis').where({ email: responsavelDados.email }).first();
  let contaCriada = false;

  if (responsavel && String(responsavel.empresa_id) !== String(empresaId)) {
    throw new AppError('Ja existe uma conta com este email em outra empresa.', 409);
  }
  if (responsavel && !responsavel.ativo) {
    throw new AppError('A conta deste responsavel esta inativa.', 409);
  }

  if (!responsavel) {
    const senha_hash = await bcrypt.hash(responsavelDados.senha, 12);
    const [novaConta] = await trx('responsaveis')
      .insert({
        empresa_id: empresaId,
        nome: responsavelDados.nome,
        email: responsavelDados.email,
        senha_hash,
        telefone: responsavelDados.telefone,
      })
      .onConflict(['email'])
      .ignore()
      .returning('*');

    responsavel = novaConta || await trx('responsaveis').where({ email: responsavelDados.email }).first();
    if (String(responsavel?.empresa_id) !== String(empresaId)) {
      throw new AppError('Ja existe uma conta com este email em outra empresa.', 409);
    }
    if (!responsavel?.ativo) throw new AppError('A conta deste responsavel esta inativa.', 409);
    contaCriada = Boolean(novaConta);
  }

  const [vinculo] = await trx('responsavel_alunos')
    .insert({
      responsavel_id: responsavel.id,
      aluno_id: alunoId,
      parentesco: responsavelDados.parentesco,
    })
    .onConflict(['responsavel_id', 'aluno_id'])
    .merge({ parentesco: responsavelDados.parentesco })
    .returning('*');

  return {
    responsavel: {
      id: responsavel.id,
      empresa_id: responsavel.empresa_id,
      nome: responsavel.nome,
      email: responsavel.email,
      telefone: responsavel.telefone,
      ativo: responsavel.ativo,
      conta_criada: contaCriada,
    },
    vinculo,
  };
}

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

async function excluir(empresaId, responsavelId) {
  const responsavel = await buscarPorId(empresaId, responsavelId);

  await db('responsaveis').where({ id: responsavelId, empresa_id: empresaId }).del();

  return responsavel;
}

function validarAcessoAoAluno(alunoIdsPermitidos, alunoId) {
  if (!Array.isArray(alunoIdsPermitidos) || !alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }
}

function colunaHorariosTurma() {
  return db.raw(`COALESCE((
    SELECT json_agg(
      json_build_object(
        'hora_entrada', ht.hora_entrada,
        'hora_saida', ht.hora_saida
      )
      ORDER BY ht.created_at
    )
    FROM horarios_turmas ht
    WHERE ht.turma_id = a.turma_id
      AND ht.empresa_id = a.empresa_id
      AND ht.ativo = true
  ), '[]'::json) AS horarios_turma`);
}

async function buscarAlunoVinculadoComHorario(empresaId, alunoIdsPermitidos, alunoId) {
  validarAcessoAoAluno(alunoIdsPermitidos, alunoId);

  const aluno = await db('alunos as a')
    .select(
      'a.id',
      'a.nome',
      'a.matricula',
      'a.turma_id',
      't.nome as turma_nome',
      'f.nome as filial_nome',
      colunaHorariosTurma()
    )
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .join('filiais as f', 'f.id', 'a.filial_id')
    .where({ 'a.id': alunoId, 'a.empresa_id': empresaId })
    .first();

  if (!aluno) throw new AppError('Aluno nao encontrado.', 404);
  aluno.horarios_turma = Array.isArray(aluno.horarios_turma) ? aluno.horarios_turma : [];
  return aluno;
}

async function listarAlunosVinculados(empresaId, alunoIds) {
  if (!alunoIds || alunoIds.length === 0) return [];

  return db('alunos as a')
    .select(
      'a.id',
      'a.nome',
      'a.matricula',
      'a.turma_id',
      't.nome as turma_nome',
      'f.nome as filial_nome',
      colunaHorariosTurma()
    )
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .join('filiais as f', 'f.id', 'a.filial_id')
    .where('a.empresa_id', empresaId)
    .whereIn('a.id', alunoIds)
    .orderBy('a.nome');
}

async function frequenciaDoAluno(empresaId, alunoIdsPermitidos, alunoId, { de, ate } = {}) {
  const alunoComHorario = await buscarAlunoVinculadoComHorario(empresaId, alunoIdsPermitidos, alunoId);

  const query = db('registros_ponto')
    .select('data_hora', 'origem', 'nsr', 'tipo_batida', 'tipo_verificacao_bruto', 'dispositivo_id')
    .where({ empresa_id: empresaId, aluno_id: alunoId })
    .orderBy('data_hora', 'desc');

  if (de) query.where('data_hora', '>=', de);
  if (ate) query.where('data_hora', '<=', ate);

  const registros = await query;
  const { horarios_turma, ...aluno } = alunoComHorario;
  return { aluno, horarios_turma, registros };
}

async function notasDoAluno(alunoIdsPermitidos, alunoId) {
  if (!alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }

  return db('notas_alunos')
    .select('id', 'disciplina', 'etapa', 'nota', 'observacao', 'created_at')
    .where({ aluno_id: alunoId })
    .orderBy('created_at', 'desc');
}

async function observacoesDoAluno(alunoIdsPermitidos, alunoId) {
  if (!alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }

  return db('observacoes_alunos')
    .select('id', 'titulo', 'texto', 'autor_nome', 'created_at')
    .where({ aluno_id: alunoId })
    .orderBy('created_at', 'desc');
}

/**
 * Auto-servico: o responsavel ja logado vincula mais um filho (o primeiro
 * vinculo acontece no cadastro pela matricula; irmaos/outros filhos entram
 * por aqui, exigindo nome completo + CPF pra conferencia). Validacao no
 * mesmo nivel do cadastro publico: so bloqueia se CPF/nome informados
 * DIVERGIREM do cadastro do aluno - nao exige que o aluno ja tenha CPF
 * cadastrado, porque isso ainda nao e obrigatorio em todo registro.
 */
async function vincularNovoFilho(empresaId, responsavelId, { nome_completo, cpf, matricula_aluno, parentesco }) {
  const aluno = await db('alunos').where({ empresa_id: empresaId, matricula: matricula_aluno }).first();
  if (!aluno) throw new AppError('Matricula de aluno nao encontrada nesta escola.', 404);

  if (aluno.cpf && cpf) {
    const soDigitos = (valor) => String(valor || '').replace(/\D/g, '');
    if (soDigitos(aluno.cpf) !== soDigitos(cpf)) {
      throw new AppError('CPF nao confere com o aluno desta matricula.', 409);
    }
  }
  if (nome_completo && aluno.nome && nome_completo.trim().toLowerCase() !== aluno.nome.trim().toLowerCase()) {
    throw new AppError('Nome nao confere com o aluno desta matricula.', 409);
  }

  const jaVinculado = await db('responsavel_alunos')
    .where({ responsavel_id: responsavelId, aluno_id: aluno.id })
    .first();
  if (jaVinculado) throw new AppError('Este aluno ja esta vinculado a sua conta.', 409);

  const [vinculo] = await db('responsavel_alunos')
    .insert({ responsavel_id: responsavelId, aluno_id: aluno.id, parentesco: parentesco || null })
    .returning('*');

  return vinculo;
}

/**
 * Presenca EM SALA (professores.registrarPresencas) - segunda checagem feita
 * pelo professor, distinta da frequenciaDoAluno (que le registros_ponto, a
 * catraca/facial na entrada da escola).
 */
async function presencaSalaDoAluno(empresaId, alunoIdsPermitidos, alunoId) {
  await buscarAlunoVinculadoComHorario(empresaId, alunoIdsPermitidos, alunoId);

  return db('presencas_sala as p')
    .select(
      'p.id',
      'p.data',
      'p.presente',
      'p.falta_justificada',
      'p.justificativa',
      'p.observacao',
      'p.professor_id',
      'u.nome as professor_nome',
      'p.atribuicao_id',
      't.nome as turma_nome',
      db.raw('COALESCE(p.materia, tp.materia) AS materia'),
      db.raw(`CASE
        WHEN p.presente = true THEN 'presente'
        WHEN p.falta_justificada = true THEN 'falta_justificada'
        ELSE 'falta_nao_justificada'
      END AS situacao`)
    )
    .leftJoin('turmas as t', function relacionarTurma() {
      this.on('t.id', '=', 'p.turma_id').andOn('t.empresa_id', '=', 'p.empresa_id');
    })
    .leftJoin('usuarios as u', function relacionarProfessor() {
      this.on('u.id', '=', 'p.professor_id').andOn('u.empresa_id', '=', 'p.empresa_id');
    })
    .leftJoin('turma_professores as tp', function relacionarAtribuicao() {
      this.on('tp.id', '=', 'p.atribuicao_id').andOn('tp.empresa_id', '=', 'p.empresa_id');
    })
    .where({ 'p.empresa_id': empresaId, 'p.aluno_id': alunoId })
    .orderBy('p.data', 'desc')
    .limit(60);
}

/**
 * Avisos da escola relevantes pro aluno: da empresa toda (filial_id nulo) ou
 * so da filial em que o aluno esta matriculado.
 */
async function avisosDoAluno(alunoIdsPermitidos, alunoId) {
  if (!alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }

  const aluno = await db('alunos').where({ id: alunoId }).first();
  if (!aluno) throw new AppError('Aluno nao encontrado.', 404);

  return db('avisos_escola')
    .select('id', 'titulo', 'mensagem', 'publicado_em')
    .where({ empresa_id: aluno.empresa_id, ativo: true })
    .andWhere('publicado_em', '<=', db.fn.now())
    .andWhere(function condicaoFilial() {
      this.where(function legado() {
        this.whereNotExists(db('aviso_alvos').select(db.raw('1')).whereRaw('aviso_alvos.aviso_id = avisos_escola.id'))
          .andWhere(function alvoLegado() {
            this.whereNull('filial_id').orWhere('filial_id', aluno.filial_id);
          })
          .andWhere(function turmaLegada() {
            this.whereNull('turma_id').orWhere('turma_id', aluno.turma_id);
          });
      }).orWhereExists(db('aviso_alvos').select(db.raw('1')).whereRaw('aviso_alvos.aviso_id = avisos_escola.id').andWhere(function alvoMultiplo() {
        this.where('filial_id', aluno.filial_id).orWhere('turma_id', aluno.turma_id);
      }));
    })
    .orderBy('publicado_em', 'desc')
    .limit(30);
}

async function registrarLeituraAviso(empresaId, avisoId, responsavelId, alunoIdsPermitidos) {
  const aviso = await db('avisos_escola').where({ id: avisoId, empresa_id: empresaId, ativo: true }).first();
  if (!aviso || !aviso.enviado_em) throw new AppError('Aviso nao encontrado.', 404);
  const aluno = await db('alunos').whereIn('id', alunoIdsPermitidos).where({ empresa_id: empresaId }).first();
  if (!aluno) throw new AppError('Voce nao possui alunos vinculados nesta empresa.', 403);
  const alvoLegado = (!aviso.filial_id || aviso.filial_id === aluno.filial_id) && (!aviso.turma_id || aviso.turma_id === aluno.turma_id);
  const alvoMultiplo = await db('aviso_alvos').where('aviso_id', avisoId).andWhere(function alvoCompativel() {
    this.where('filial_id', aluno.filial_id).orWhere('turma_id', aluno.turma_id);
  }).first('id');
  const possuiAlvoMultiplo = await db('aviso_alvos').where('aviso_id', avisoId).first('id');
  if ((possuiAlvoMultiplo && !alvoMultiplo) || (!possuiAlvoMultiplo && !alvoLegado)) {
    throw new AppError('Voce nao tem acesso a este aviso.', 403);
  }
  const [leitura] = await db('aviso_leituras').insert({ aviso_id: avisoId, responsavel_id: responsavelId }).onConflict(['aviso_id', 'responsavel_id']).ignore().returning('*');
  return leitura || db('aviso_leituras').where({ aviso_id: avisoId, responsavel_id: responsavelId }).first();
}

async function registrarPushToken(responsavelId, token, plataforma) {
  const [registro] = await db('push_tokens')
    .insert({ responsavel_id: responsavelId, token, plataforma })
    .onConflict(['token'])
    .merge({ responsavel_id: responsavelId, plataforma })
    .returning('*');

  return registro;
}

module.exports = {
  login,
  cadastrar,
  criarOuVincularAoAluno,
  vincularAluno,
  vincularNovoFilho,
  listarAlunosVinculados,
  frequenciaDoAluno,
  notasDoAluno,
  observacoesDoAluno,
  presencaSalaDoAluno,
  avisosDoAluno,
  registrarLeituraAviso,
  registrarPushToken,
  obterAlunoIdsVinculados,
  buscarPorId,
  excluir,
};
