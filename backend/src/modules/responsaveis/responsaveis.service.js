const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { publicarEvento } = require('../../realtime');
const { classificarBatidasDeAluno, janelaDeDiasCompletos } = require('../ponto/classificacaoBatidas');

const LIMITE_PEDIDOS_VINCULO_PENDENTES = 5;

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
  if (telefone && telefone.length > 20) {
    throw new AppError('O telefone do responsavel deve ter no maximo 20 caracteres.', 400);
  }
  if (parentesco && parentesco.length > 40) {
    throw new AppError('O parentesco deve ter no maximo 40 caracteres.', 400);
  }

  return { nome, email, senha, telefone, parentesco };
}

 // Cria um novo acesso de responsavel para vinculo com o aluno.


async function criarOuVincularAoAluno(trx, empresaId, alunoId, dados) {
  const responsavelDados = normalizarDadosDeAcesso(dados);
  const existente = await trx('responsaveis').whereRaw('LOWER(email) = ?', [responsavelDados.email]).first('id');
  if (existente) {
    throw new AppError('Ja existe uma conta com este email. Selecione o responsavel existente para vincular.', 409);
  }

  if (responsavelDados.senha.length < 8) {
    throw new AppError('A senha do responsavel deve ter no minimo 8 caracteres.', 400);
  }
  const senha_hash = await bcrypt.hash(responsavelDados.senha, 12);
  const [responsavel] = await trx('responsaveis')
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

  // Outra requisicao pode cadastrar o email depois da consulta inicial.
  if (!responsavel) {
    throw new AppError('Ja existe uma conta com este email. Selecione o responsavel existente para vincular.', 409);
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
      conta_criada: true, //conta nova true
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

async function criarPedidoVinculoPendente(
  trx,
  empresaId,
  responsavelId,
  { matricula_aluno, nome_completo, cpf, parentesco }
) {
  const responsavel = await trx('responsaveis')
    .where({ id: responsavelId, empresa_id: empresaId })
    .forUpdate()
    .first('id');
  if (!responsavel) throw new AppError('Responsavel nao encontrado.', 404);

  const [{ total }] = await trx('pedidos_vinculo_responsaveis')
    .where({ responsavel_id: responsavelId, status: 'pendente' })
    .count('* as total');
  if (Number(total) >= LIMITE_PEDIDOS_VINCULO_PENDENTES) {
    throw new AppError(`Voce pode ter no maximo ${LIMITE_PEDIDOS_VINCULO_PENDENTES} pedidos de vinculo pendentes.`, 429);
  }

  const aluno = await trx('alunos')
    .where({ empresa_id: empresaId, matricula: String(matricula_aluno || '').trim() })
    .first('id', 'nome', 'cpf');
  if (!aluno) return null;

  if (aluno.cpf && cpf && String(aluno.cpf).replace(/\D/g, '') !== String(cpf).replace(/\D/g, '')) {
    return null;
  }
  if (
    nome_completo
    && aluno.nome
    && String(nome_completo).trim().toLowerCase() !== aluno.nome.trim().toLowerCase()
  ) {
    return null;
  }

  const jaVinculado = await trx('responsavel_alunos')
    .where({ responsavel_id: responsavelId, aluno_id: aluno.id })
    .first('id');
  if (jaVinculado) return null;

  try {
    const [pedido] = await trx('pedidos_vinculo_responsaveis')
      .insert({
        empresa_id: empresaId,
        responsavel_id: responsavelId,
        aluno_id: aluno.id,
        parentesco: parentesco || null,
      })
      .returning('*');
    return pedido;
  } catch (err) {
    if (err.code === '23505') return null;
    throw err;
  }
}

/**
 * Cria a conta do responsavel e encaminha o vinculo inicial para aprovacao.
 * A conta nao recebe acesso ao aluno ate a decisao da escola.
 */
async function cadastrar({ empresa_id, nome, email, senha, telefone, matricula_aluno }) {
  const existente = await db('responsaveis').where({ email: email.toLowerCase().trim() }).first();
  if (existente) throw new AppError('Ja existe uma conta com este email.', 409);

  const senha_hash = await bcrypt.hash(senha, 12);
  const descarteSilencioso = new Error('Solicitacao descartada por nao passar pela validacao.');
  let resultado;
  try {
    resultado = await db.transaction(async (trx) => {
      const [responsavel] = await trx('responsaveis')
        .insert({ empresa_id, nome, email: email.toLowerCase().trim(), senha_hash, telefone: telefone || null })
        .returning('*');

      const pedido = await criarPedidoVinculoPendente(trx, empresa_id, responsavel.id, { matricula_aluno });
      if (!pedido) throw descarteSilencioso;
      return { responsavel, pedido };
    });
  } catch (err) {
    if (err === descarteSilencioso) return null;
    if (err.code === '23505') throw new AppError('Ja existe uma conta com este email.', 409);
    throw err;
  }

  if (resultado.pedido) {
    publicarEvento('responsavel.vinculo.solicitado', {
      empresaId: empresa_id,
      responsavelId: resultado.responsavel.id,
      pedidoId: resultado.pedido.id,
    });
  }
  return resultado.responsavel;
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

async function vincularResponsavelAoAluno(
  empresaId,
  alunoId,
  responsavelId,
  parentesco = null,
  { filialId = null, usuarioId, ip } = {}
) {
  const parentescoNormalizado = normalizarAtualizacaoContaResponsavel({ parentesco }).parentesco;
  const resultado = await db.transaction(async (trx) => {
    const alunoQuery = trx('alunos').where({ id: alunoId, empresa_id: empresaId });
    if (filialId) alunoQuery.where({ filial_id: filialId });
    if (!(await alunoQuery.first('id'))) throw new AppError('Aluno nao encontrado nesta empresa.', 404);

    const responsavel = await trx('responsaveis')
      .where({ id: responsavelId, empresa_id: empresaId, ativo: true })
      .first('id');
    if (!responsavel) throw new AppError('Responsavel nao encontrado ou inativo nesta empresa.', 404);

    const existente = await trx('responsavel_alunos')
      .where({ responsavel_id: responsavelId, aluno_id: alunoId })
      .first('parentesco');
    const [vinculo] = await trx('responsavel_alunos')
      .insert({ responsavel_id: responsavelId, aluno_id: alunoId, parentesco: parentescoNormalizado })
      .onConflict(['responsavel_id', 'aluno_id'])
      .merge({ parentesco: parentescoNormalizado })
      .returning('*');
    if (!existente || existente.parentesco !== parentescoNormalizado) {
      await trx('auditoria_logs').insert({
        empresa_id: empresaId,
        usuario_id: usuarioId || null,
        acao: existente ? 'atualizar_vinculo_responsavel' : 'vincular_responsavel_aluno',
        entidade: 'responsavel_alunos',
        entidade_id: String(vinculo.id),
        dados_antes: existente || null,
        dados_depois: { responsavel_id: responsavelId, aluno_id: alunoId, parentesco: parentescoNormalizado },
        ip_origem: ip,
      });
    }
    return { vinculo, ja_vinculado: Boolean(existente) };
  });
  if (!resultado.ja_vinculado) {
    publicarEvento('responsavel.vinculado', { empresaId, responsavelId, alunoId });
  }
  return resultado;
}

async function listarResponsaveisDoAluno(empresaId, alunoId, filialId = null) {
  const alunoQuery = db('alunos').where({ id: alunoId, empresa_id: empresaId });
  if (filialId) alunoQuery.where({ filial_id: filialId });
  if (!(await alunoQuery.first('id'))) throw new AppError('Aluno nao encontrado.', 404);

  const query = db('responsavel_alunos as ra')
    .join('alunos as a', 'a.id', 'ra.aluno_id')
    .join('responsaveis as r', 'r.id', 'ra.responsavel_id')
    .select(
      'r.id',
      'r.nome',
      'r.email',
      'r.telefone',
      'r.ativo',
      'ra.parentesco',
      'ra.created_at as vinculado_em'
    )
    .where({
      'ra.aluno_id': alunoId,
      'a.empresa_id': empresaId,
      'r.empresa_id': empresaId,
    })
    .orderBy('r.nome');

  if (filialId) query.where('a.filial_id', filialId);
  return query;
}

async function listarResponsaveisDaEmpresa(empresaId, busca) { // get de busca
  if (typeof busca !== 'string' || !busca.trim()) {
    throw new AppError('Informe uma busca por nome ou email do responsavel.', 400);
  }
  const termo = busca.trim().toLowerCase();
  if (termo.length > 150) {
    throw new AppError('A busca deve ter no maximo 150 caracteres.', 400);
  } 

  return db('responsaveis')
    .select('id', 'nome', 'email', 'telefone', 'ativo')
    .where({ empresa_id: empresaId })
    .whereRaw('(strpos(LOWER(nome), ?) > 0 OR strpos(LOWER(email), ?) > 0)', [termo, termo])
    .orderBy('nome');
}

function normalizarAtualizacaoContaResponsavel(dados = {}) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new AppError('Dados do responsavel invalidos.', 400);
  }

  const permitidos = ['nome', 'email', 'telefone', 'senha', 'parentesco'];
  const camposInformados = permitidos.filter((campo) => Object.prototype.hasOwnProperty.call(dados, campo));
  if (!camposInformados.length) throw new AppError('Informe ao menos um dado para atualizar.', 400);

  const atualizacao = {};
  if (camposInformados.includes('nome')) {
    if (typeof dados.nome !== 'string') throw new AppError('Nome do responsavel invalido.', 400);
    const nome = dados.nome.trim();
    if (!nome || nome.length > 150) throw new AppError('Nome do responsavel invalido.', 400);
    atualizacao.nome = nome;
  }
  if (camposInformados.includes('email')) {
    if (typeof dados.email !== 'string') throw new AppError('Email do responsavel invalido.', 400);
    const email = dados.email.trim().toLowerCase();
    if (!email || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Email do responsavel invalido.', 400);
    }
    atualizacao.email = email;
  }
  if (camposInformados.includes('telefone')) {
    if (dados.telefone !== null && typeof dados.telefone !== 'string') {
      throw new AppError('Telefone do responsavel invalido.', 400);
    }
    const telefone = String(dados.telefone || '').trim();
    if (telefone.length > 20) throw new AppError('Telefone do responsavel invalido.', 400);
    atualizacao.telefone = telefone || null;
  }
  if (camposInformados.includes('senha') && dados.senha !== null && dados.senha !== '') {
    if (typeof dados.senha !== 'string' || dados.senha.length < 8) {
      throw new AppError('A senha do responsavel deve ter no minimo 8 caracteres.', 400);
    }
    atualizacao.senha = dados.senha;
  }
  if (camposInformados.includes('parentesco')) {
    if (dados.parentesco !== null && typeof dados.parentesco !== 'string') {
      throw new AppError('Parentesco invalido.', 400);
    }
    const parentesco = String(dados.parentesco || '').trim();
    if (parentesco.length > 40) throw new AppError('Parentesco invalido.', 400);
    atualizacao.parentesco = parentesco || null;
  }

  if (!Object.keys(atualizacao).length) throw new AppError('Informe ao menos um dado para atualizar.', 400);
  return atualizacao;
}

async function atualizarResponsavelDaEmpresa(empresaId, responsavelId, dados, { usuarioId, ip } = {}) {
  const atualizacao = normalizarAtualizacaoContaResponsavel(dados);
  if (atualizacao.parentesco !== undefined) {
    throw new AppError('Parentesco deve ser atualizado no vinculo com o aluno.', 400);
  }

  try {
    return await db.transaction(async (trx) => {
      const responsavel = await trx('responsaveis')
        .where({ id: responsavelId, empresa_id: empresaId })
        .first('id', 'nome', 'email', 'telefone', 'ativo');
      if (!responsavel) throw new AppError('Responsavel nao encontrado nesta empresa.', 404);

      const dadosConta = {};
      for (const campo of ['nome', 'email', 'telefone']) {
        if (atualizacao[campo] !== undefined) dadosConta[campo] = atualizacao[campo];
      }
      if (
        dadosConta.email
        && dadosConta.email !== responsavel.email
        && await trx('responsaveis').where({ email: dadosConta.email }).whereNot('id', responsavelId).first('id')
      ) {
        throw new AppError('Ja existe uma conta com este email.', 409);
      }

      const senhaAlterada = Boolean(atualizacao.senha);
      if (senhaAlterada) dadosConta.senha_hash = await bcrypt.hash(atualizacao.senha, 12);
      if (Object.keys(dadosConta).length) {
        await trx('responsaveis').where({ id: responsavelId, empresa_id: empresaId }).update(dadosConta);
      }

      const resultado = {
        id: responsavelId,
        nome: dadosConta.nome ?? responsavel.nome,
        email: dadosConta.email ?? responsavel.email,
        telefone: dadosConta.telefone !== undefined ? dadosConta.telefone : responsavel.telefone,
        ativo: responsavel.ativo,
      };
      const houveAlteracao = Object.entries(dadosConta).some(([campo, valor]) =>
        campo === 'senha_hash' || valor !== responsavel[campo]
      );
      if (houveAlteracao) {
        await trx('auditoria_logs').insert({
          empresa_id: empresaId,
          usuario_id: usuarioId || null,
          acao: 'atualizar_conta_responsavel',
          entidade: 'responsaveis',
          entidade_id: String(responsavelId),
          dados_antes: responsavel,
          dados_depois: { ...resultado, senha_alterada: senhaAlterada },
          ip_origem: ip,
        });
      }
      return { responsavel: resultado };
    });
  } catch (err) {
    if (err.code === '23505') throw new AppError('Ja existe uma conta com este email.', 409);
    throw err;
  }
}

async function atualizarContaResponsavel(
  empresaId,
  alunoId,
  responsavelId,
  dados,
  { filialId = null, usuarioId, ip } = {}
) {
  const atualizacao = normalizarAtualizacaoContaResponsavel(dados);

  try {
    return await db.transaction(async (trx) => {
      const vinculo = await trx('responsavel_alunos as ra')
        .join('alunos as a', 'a.id', 'ra.aluno_id')
        .join('responsaveis as r', 'r.id', 'ra.responsavel_id')
        .select(
          'r.id',
          'r.empresa_id',
          'r.nome',
          'r.email',
          'r.telefone',
          'r.ativo',
          'ra.parentesco'
        )
        .where({
          'ra.aluno_id': alunoId,
          'ra.responsavel_id': responsavelId,
          'a.empresa_id': empresaId,
          'r.empresa_id': empresaId,
        })
        .modify((query) => {
          if (filialId) query.where('a.filial_id', filialId);
        })
        .first();
      if (!vinculo) throw new AppError('Responsavel nao encontrado para este aluno.', 404);

      const dadosAntes = {
        nome: vinculo.nome,
        email: vinculo.email,
        telefone: vinculo.telefone,
        parentesco: vinculo.parentesco,
      };
      const dadosConta = {};
      for (const campo of ['nome', 'email', 'telefone']) {
        if (atualizacao[campo] !== undefined) dadosConta[campo] = atualizacao[campo];
      }

      if (
        dadosConta.email
        && dadosConta.email !== vinculo.email
        && await trx('responsaveis').where({ email: dadosConta.email }).whereNot('id', responsavelId).first('id')
      ) {
        throw new AppError('Ja existe uma conta com este email.', 409);
      }

      const senhaAlterada = Boolean(atualizacao.senha);
      if (senhaAlterada) dadosConta.senha_hash = await bcrypt.hash(atualizacao.senha, 12);

      if (Object.keys(dadosConta).length) {
        await trx('responsaveis').where({ id: responsavelId, empresa_id: empresaId }).update(dadosConta);
      }
      if (atualizacao.parentesco !== undefined) {
        await trx('responsavel_alunos')
          .where({ responsavel_id: responsavelId, aluno_id: alunoId })
          .update({ parentesco: atualizacao.parentesco });
      }

      const resultado = {
        id: responsavelId,
        nome: dadosConta.nome ?? vinculo.nome,
        email: dadosConta.email ?? vinculo.email,
        telefone: dadosConta.telefone !== undefined ? dadosConta.telefone : vinculo.telefone,
        ativo: vinculo.ativo,
      };
      const parentesco = atualizacao.parentesco !== undefined ? atualizacao.parentesco : vinculo.parentesco;
      const houveAlteracao = Object.entries(dadosConta).some(([campo, valor]) => {
        if (campo === 'senha_hash') return true;
        return valor !== vinculo[campo];
      }) || parentesco !== vinculo.parentesco;

      if (houveAlteracao) {
        await trx('auditoria_logs').insert({
          empresa_id: empresaId,
          usuario_id: usuarioId || null,
          acao: 'atualizar_conta_responsavel',
          entidade: 'responsaveis',
          entidade_id: String(responsavelId),
          dados_antes: dadosAntes,
          dados_depois: { ...resultado, parentesco, senha_alterada: senhaAlterada },
          ip_origem: ip,
        });
      }

      return { responsavel: resultado, parentesco };
    });
  } catch (err) {
    if (err.code === '23505') throw new AppError('Ja existe uma conta com este email.', 409);
    throw err;
  }
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

function classificarAlcanceAviso(aviso, alvos) {
  if (!alvos.length) {
    if (aviso.turma_id) return { alcance: 'turma', turma_id: aviso.turma_id, filial_id: aviso.filial_id || null };
    if (aviso.filial_id) return { alcance: 'escola', filial_id: aviso.filial_id, turma_id: null };
    return { alcance: 'rede', filial_id: null, turma_id: null };
  }

  const filiais = new Set(alvos.map((alvo) => alvo.filial_id).filter(Boolean));
  const turmas = new Set(alvos.map((alvo) => alvo.turma_id).filter(Boolean));
  if (filiais.size > 1) return { alcance: 'rede', filial_id: null, turma_id: null };
  if (filiais.size === 1) return { alcance: 'escola', filial_id: [...filiais][0], turma_id: null };
  if (turmas.size > 0) return { alcance: 'turma', filial_id: null, turma_id: turmas.size === 1 ? [...turmas][0] : null };
  return { alcance: 'rede', filial_id: null, turma_id: null };
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

  const query = db('registros_ponto as r')
    .select(
      'r.id',
      'r.aluno_id',
      'r.data_hora',
      'r.origem',
      'r.nsr',
      'r.tipo_batida',
      'r.tipo_verificacao_bruto',
      'r.dispositivo_id',
      'f.fuso_horario as filial_fuso_horario',
    )
    .leftJoin('filiais as f', 'f.id', 'r.filial_id')
    .where({ 'r.empresa_id': empresaId, 'r.aluno_id': alunoId })
    .orderBy('r.data_hora', 'desc');

  // Dias fechados: quem decide chegada/saida e o sistema, pela ordem das
  // passagens no dia, e um recorte no meio do dia trocaria a fase.
  const janela = janelaDeDiasCompletos(de, ate);
  if (janela.de) query.where('r.data_hora', '>=', janela.de);
  if (janela.ate) query.where('r.data_hora', '<=', janela.ate);

  const registros = await query;
  classificarBatidasDeAluno(registros);

  const { horarios_turma, ...aluno } = alunoComHorario;
  return {
    aluno,
    horarios_turma,
    registros: registros.map(({ filial_fuso_horario, ...registro }) => registro),
  };
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
 * O responsavel autenticado solicita incluir outro aluno, com conferencia
 * dos dados informados. O vinculo so e criado depois da decisao da escola.
 */
async function vincularNovoFilho(empresaId, responsavelId, dados) {
  const pedido = await db.transaction((trx) =>
    criarPedidoVinculoPendente(trx, empresaId, responsavelId, dados)
  );
  if (pedido) {
    publicarEvento('responsavel.vinculo.solicitado', { empresaId, responsavelId, pedidoId: pedido.id });
  }
  return { status: 'recebido' };
}

async function listarMeusPedidosVinculo(empresaId, responsavelId) {
  return db('pedidos_vinculo_responsaveis as p')
    .join('alunos as a', 'a.id', 'p.aluno_id')
    .select('p.id', 'p.status', 'p.parentesco', 'p.created_at', 'p.decidido_em', 'a.id as aluno_id', 'a.nome as aluno_nome', 'a.matricula')
    .where({ 'p.empresa_id': empresaId, 'p.responsavel_id': responsavelId })
    .orderBy('p.created_at', 'desc');
}

async function listarPedidosVinculo(empresaId, filialId = null) {
  const query = db('pedidos_vinculo_responsaveis as p')
    .join('alunos as a', 'a.id', 'p.aluno_id')
    .join('responsaveis as r', 'r.id', 'p.responsavel_id')
    .select(
      'p.id', 'p.status', 'p.parentesco', 'p.created_at', 'p.decidido_em',
      'a.id as aluno_id', 'a.nome as aluno_nome', 'a.matricula',
      'r.id as responsavel_id', 'r.nome as responsavel_nome', 'r.email as responsavel_email'
    )
    .where({ 'p.empresa_id': empresaId })
    .orderBy('p.created_at', 'asc');
  if (filialId) query.where('a.filial_id', filialId);
  return query;
}

async function listarNotificacoesVinculo(empresaId, filialId = null) {
  const query = db('pedidos_vinculo_responsaveis as p')
    .join('alunos as a', 'a.id', 'p.aluno_id')
    .join('responsaveis as r', 'r.id', 'p.responsavel_id')
    .select(
      'p.id',
      'p.created_at as criado_em',
      'a.id as aluno_id',
      'a.nome as aluno_nome',
      'a.matricula',
      'r.id as responsavel_id',
      'r.nome as responsavel_nome',
      'r.email as responsavel_email',
      'r.telefone as responsavel_telefone' //telefone add select
    )
    .where({ 'p.empresa_id': empresaId, 'p.status': 'pendente' })
    .orderBy('p.created_at', 'desc');
  if (filialId) query.where('a.filial_id', filialId);

  const pedidos = await query;
  return pedidos.map((pedido) => ({
    id: pedido.id,
    tipo: 'responsavel.vinculo.solicitado',
    titulo: 'Solicitação de vínculo de aluno',
    mensagem: `${pedido.responsavel_nome} solicita vínculo com ${pedido.aluno_nome}.`,
    criado_em: pedido.criado_em,
    pedido_id: pedido.id,
    aluno: {
      id: pedido.aluno_id,
      nome: pedido.aluno_nome,
      matricula: pedido.matricula,
    },
    responsavel: {
      id: pedido.responsavel_id,
      nome: pedido.responsavel_nome,
      email: pedido.responsavel_email,
      telefone: pedido.responsavel_telefone ?? null, //body retorno
    },
  }));
}

async function decidirPedidoVinculo(empresaId, pedidoId, decisao, { filialId = null, usuarioId, ip } = {}) {
  if (!['aprovado', 'rejeitado'].includes(decisao)) throw new AppError('Decisao invalida.', 400);

  const resultado = await db.transaction(async (trx) => {
    const query = trx('pedidos_vinculo_responsaveis as p')
      .join('alunos as a', 'a.id', 'p.aluno_id')
      .join('responsaveis as r', 'r.id', 'p.responsavel_id')
      .select('p.*', 'a.filial_id', 'r.ativo as responsavel_ativo')
      .where({ 'p.id': pedidoId, 'p.empresa_id': empresaId })
      .forUpdate('p');
    if (filialId) query.where('a.filial_id', filialId);
    const pedido = await query.first();
    if (!pedido) throw new AppError('Pedido de vinculo nao encontrado.', 404);
    if (pedido.status !== 'pendente') throw new AppError('Este pedido ja foi tratado.', 409);

    if (decisao === 'aprovado') {
      if (!pedido.responsavel_ativo) throw new AppError('A conta do responsavel esta inativa.', 409);
      const [vinculo] = await trx('responsavel_alunos')
        .insert({
          responsavel_id: pedido.responsavel_id,
          aluno_id: pedido.aluno_id,
          parentesco: pedido.parentesco,
        })
        .onConflict(['responsavel_id', 'aluno_id'])
        .merge({ parentesco: pedido.parentesco })
        .returning('id');
      if (!vinculo) throw new AppError('Nao foi possivel criar o vinculo do responsavel.', 409);
    }

    await trx('pedidos_vinculo_responsaveis')
      .where({ id: pedidoId, empresa_id: empresaId, status: 'pendente' })
      .update({ status: decisao, decidido_por: usuarioId || null, decidido_em: trx.fn.now(), updated_at: trx.fn.now() });

    await trx('auditoria_logs').insert({
      empresa_id: empresaId,
      usuario_id: usuarioId || null,
      acao: decisao === 'aprovado' ? 'aprovar_pedido_vinculo_responsavel' : 'rejeitar_pedido_vinculo_responsavel',
      entidade: 'pedidos_vinculo_responsaveis',
      entidade_id: String(pedidoId),
      dados_antes: { status: 'pendente' },
      dados_depois: { status: decisao, aluno_id: pedido.aluno_id, responsavel_id: pedido.responsavel_id },
      ip_origem: ip,
    });

    return {
      id: pedidoId,
      status: decisao,
      aluno_id: pedido.aluno_id,
      responsavel_id: pedido.responsavel_id,
    };
  });
  publicarEvento('responsavel.vinculo.decidido', {
    empresaId,
    responsavelId: resultado.responsavel_id,
    pedidoId,
    alunoId: resultado.aluno_id,
    status: decisao,
  });
  return resultado;
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

  const avisos = await db('avisos_escola')
    .select('id', 'titulo', 'mensagem', 'publicado_em', 'filial_id', 'turma_id')
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

  if (!avisos.length) return avisos;

  const alvos = await db('aviso_alvos')
    .select('aviso_id', 'filial_id', 'turma_id')
    .whereIn('aviso_id', avisos.map((aviso) => aviso.id));
  const porAviso = new Map();
  for (const alvo of alvos) {
    if (!porAviso.has(alvo.aviso_id)) porAviso.set(alvo.aviso_id, []);
    porAviso.get(alvo.aviso_id).push(alvo);
  }

  return avisos.map((aviso) => ({
    ...aviso,
    ...classificarAlcanceAviso(aviso, porAviso.get(aviso.id) || []),
  }));
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
  if (leitura) publicarEvento('aviso.lido', { empresaId, avisoId });
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

function validarEndpointPushWeb(valor) {
  const endpoint = typeof valor === 'string' ? valor.trim() : '';
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new AppError('Inscricao Web Push invalida.', 400);
  }
  if (endpointUrl.protocol !== 'https:' || endpoint.length > 2048) {
    throw new AppError('Inscricao Web Push invalida.', 400);
  }
  return endpoint;
}

async function registrarPushWeb(responsavelId, subscription) {
  const endpoint = validarEndpointPushWeb(subscription?.endpoint);
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (typeof p256dh !== 'string' || !p256dh || p256dh.length > 200 || typeof auth !== 'string' || !auth || auth.length > 200) {
    throw new AppError('Inscricao Web Push invalida.', 400);
  }

  const [registro] = await db('push_web')
    .insert({ responsavel_id: responsavelId, endpoint, p256dh, auth })
    .onConflict('endpoint')
    .merge({ responsavel_id: responsavelId, p256dh, auth, updated_at: db.fn.now() })
    .returning(['id']);
  return registro;
}

async function removerPushWeb(responsavelId, dados) {
  const endpoint = validarEndpointPushWeb(dados?.endpoint);
  return db('push_web').where({ responsavel_id: responsavelId, endpoint }).del();
}

module.exports = {
  login,
  cadastrar,
  criarOuVincularAoAluno,
  vincularAluno,
  vincularResponsavelAoAluno,
  listarResponsaveisDoAluno,
  listarResponsaveisDaEmpresa,
  atualizarResponsavelDaEmpresa,
  atualizarContaResponsavel,
  vincularNovoFilho,
  listarMeusPedidosVinculo,
  listarPedidosVinculo,
  listarNotificacoesVinculo,
  decidirPedidoVinculo,
  listarAlunosVinculados,
  frequenciaDoAluno,
  notasDoAluno,
  observacoesDoAluno,
  presencaSalaDoAluno,
  avisosDoAluno,
  registrarLeituraAviso,
  registrarPushToken,
  registrarPushWeb,
  removerPushWeb,
  obterAlunoIdsVinculados,
  buscarPorId,
  excluir,
};
