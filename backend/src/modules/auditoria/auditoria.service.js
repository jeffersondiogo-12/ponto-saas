const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 200;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizarInteiroPositivo(valor, campo, padrao = null) {
  if (valor === undefined || valor === null || valor === '') return padrao;

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new AppError(`${campo} deve ser um numero inteiro positivo.`, 400);
  }

  return numero;
}

function normalizarData(valor, campo) {
  if (!valor) return null;

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    throw new AppError(`${campo} deve ser uma data valida.`, 400);
  }

  return data;
}

function normalizarUuid(valor, campo) {
  if (!valor) return null;

  const uuid = String(valor).trim();
  if (!UUID_REGEX.test(uuid)) {
    throw new AppError(`${campo} deve ser um UUID valido.`, 400);
  }

  return uuid;
}

function aplicarFiltros(query, empresaId, filtros) {
  query.where('a.empresa_id', empresaId);

  if (filtros.usuarioId) query.where('a.usuario_id', filtros.usuarioId);
  if (filtros.acao) query.where('a.acao', String(filtros.acao).trim());
  if (filtros.entidade) query.where('a.entidade', String(filtros.entidade).trim());
  if (filtros.entidadeId) query.where('a.entidade_id', String(filtros.entidadeId).trim());
  if (filtros.de) query.where('a.criado_em', '>=', filtros.de);
  if (filtros.ate) query.where('a.criado_em', '<=', filtros.ate);

  return query;
}

function selecionarCampos(query) {
  return query.select(
    'a.id',
    'a.empresa_id',
    'a.usuario_id',
    'u.nome as usuario_nome',
    'u.email as usuario_email',
    'a.acao',
    'a.entidade',
    'a.entidade_id',
    'a.dados_antes',
    'a.dados_depois',
    'a.ip_origem',
    'a.criado_em'
  );
}

async function listar(
  empresaId,
  { usuarioId, acao, entidade, entidadeId, de, ate, pagina, limite } = {}
) {
  const paginaNormalizada = normalizarInteiroPositivo(pagina, 'pagina', 1);
  const limiteInformado = normalizarInteiroPositivo(limite, 'limite', LIMITE_PADRAO);
  const limiteNormalizado = Math.min(limiteInformado, LIMITE_MAXIMO);
  const usuarioIdNormalizado = normalizarUuid(usuarioId, 'usuario_id');
  const dataInicial = normalizarData(de, 'de');
  const dataFinal = normalizarData(ate, 'ate');

  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    throw new AppError('de nao pode ser posterior a ate.', 400);
  }

  const filtros = {
    usuarioId: usuarioIdNormalizado,
    acao,
    entidade,
    entidadeId,
    de: dataInicial,
    ate: dataFinal,
  };

  const consultaBase = aplicarFiltros(db('auditoria_logs as a'), empresaId, filtros);
  const deslocamento = (paginaNormalizada - 1) * limiteNormalizado;

  const consultaLogs = selecionarCampos(
    consultaBase.clone().leftJoin('usuarios as u', 'u.id', 'a.usuario_id')
  )
    .orderBy('a.criado_em', 'desc')
    .orderBy('a.id', 'desc')
    .limit(limiteNormalizado)
    .offset(deslocamento);

  const consultaTotal = consultaBase.clone().count({ total: 'a.id' }).first();
  const [logs, totalRegistro] = await Promise.all([consultaLogs, consultaTotal]);
  const total = Number(totalRegistro.total) || 0;

  return {
    logs,
    paginacao: {
      pagina: paginaNormalizada,
      limite: limiteNormalizado,
      total,
      total_paginas: Math.ceil(total / limiteNormalizado),
    },
  };
}

async function buscarPorId(empresaId, auditoriaId) {
  if (!/^\d+$/.test(String(auditoriaId))) {
    throw new AppError('ID do log de auditoria invalido.', 400);
  }

  const log = await selecionarCampos(
    db('auditoria_logs as a').leftJoin('usuarios as u', 'u.id', 'a.usuario_id')
  )
    .where({ 'a.id': auditoriaId, 'a.empresa_id': empresaId })
    .first();

  if (!log) throw new AppError('Log de auditoria nao encontrado.', 404);
  return log;
}

module.exports = { listar, buscarPorId };
