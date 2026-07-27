const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { encrypt, decrypt } = require('../../utils/crypto');
const { criarAdapter } = require('./adapters');

// Nunca deixamos a senha (cifrada ou nao) sair para a API/tela.
function sanitizar(dispositivo) {
  if (!dispositivo) return dispositivo;
  const { senha_dispositivo_cifrada, ...resto } = dispositivo;
  return { ...resto, senha_configurada: Boolean(senha_dispositivo_cifrada) };
}

async function listar(empresaId) {
  const dispositivos = await db('dispositivos')
    .where({ empresa_id: empresaId })
    .orderBy('descricao');
  return dispositivos.map(sanitizar);
}

async function buscarPorId(empresaId, dispositivoId) {
  const dispositivo = await db('dispositivos')
    .where({ id: dispositivoId, empresa_id: empresaId })
    .first();
  if (!dispositivo) throw new AppError('Dispositivo nao encontrado.', 404);
  return dispositivo; // versao NAO sanitizada, uso interno (ex: forcarColeta)
}

async function criar(empresaId, dados) {
  const serieExistente = await db('dispositivos')
    .where({ empresa_id: empresaId, numero_serie: dados.numero_serie })
    .first();
  if (serieExistente) {
    throw new AppError('Ja existe um dispositivo cadastrado com este numero de serie.', 409);
  }

  const [dispositivo] = await db('dispositivos')
    .insert({
      empresa_id: empresaId,
      filial_id: dados.filial_id || null,
      descricao: dados.descricao,
      modelo: dados.modelo || 'Facial AI 5',
      tipo_biometria: dados.tipo_biometria || 'facial',
      situacao: dados.situacao || 'ativo',
      fuso_horario: dados.fuso_horario || 'America/Sao_Paulo',
      enviar_comprovante_email: Boolean(dados.enviar_comprovante_email),
      modo_conexao: dados.modo_conexao || 'client',
      ip: dados.ip,
      porta: dados.porta || 4370,
      nao_validar_empresa: Boolean(dados.nao_validar_empresa),
      numero_serie: dados.numero_serie,
      mac_address: dados.mac_address || null,
      usuario_dispositivo: dados.usuario_dispositivo || null,
      senha_dispositivo_cifrada: encrypt(dados.senha_dispositivo),
      identificador_equipamento: dados.identificador_equipamento || null,
      protocolo: dados.protocolo || 'desconhecido',
    })
    .returning('*');

  return sanitizar(dispositivo);
}

async function atualizar(empresaId, dispositivoId, dados) {
  await buscarPorId(empresaId, dispositivoId);

  const patch = {
    filial_id: dados.filial_id || null,
    descricao: dados.descricao,
    modelo: dados.modelo,
    tipo_biometria: dados.tipo_biometria,
    situacao: dados.situacao,
    fuso_horario: dados.fuso_horario,
    enviar_comprovante_email: Boolean(dados.enviar_comprovante_email),
    modo_conexao: dados.modo_conexao,
    ip: dados.ip,
    porta: dados.porta,
    nao_validar_empresa: Boolean(dados.nao_validar_empresa),
    mac_address: dados.mac_address || null,
    usuario_dispositivo: dados.usuario_dispositivo || null,
    identificador_equipamento: dados.identificador_equipamento || null,
    protocolo: dados.protocolo,
  };

  // Só reescreve a senha se uma nova foi enviada (campo em branco = manter a atual).
  if (dados.senha_dispositivo) {
    patch.senha_dispositivo_cifrada = encrypt(dados.senha_dispositivo);
  }

  const [dispositivo] = await db('dispositivos')
    .where({ id: dispositivoId, empresa_id: empresaId })
    .update(patch)
    .returning('*');

  return sanitizar(dispositivo);
}

/**
 * Monta um adapter pronto para uso, com a senha ja descriptografada em
 * memoria (nunca loga isso, nunca retorna via API).
 */
async function obterAdapter(empresaId, dispositivoId) {
  const dispositivo = await buscarPorId(empresaId, dispositivoId);
  const dispositivoComSenha = {
    ...dispositivo,
    senha_dispositivo: decrypt(dispositivo.senha_dispositivo_cifrada),
  };
  return criarAdapter(dispositivoComSenha);
}

async function testarConexao(empresaId, dispositivoId) {
  const adapter = await obterAdapter(empresaId, dispositivoId);
  return adapter.testarConexao();
}

/**
 * Equivalente ao botao "FORCAR COLETA" da tela de configuracao: conecta,
 * busca tudo que for novo desde o ultimo_nsr salvo, e devolve os registros
 * brutos (quem grava no banco e o modulo de ponto, para manter este service
 * focado soh na comunicacao com o hardware).
 */
async function forcarColeta(empresaId, dispositivoId) {
  const dispositivo = await buscarPorId(empresaId, dispositivoId);
  const adapter = await obterAdapter(empresaId, dispositivoId);

  await adapter.conectar();
  let registros;
  try {
    registros = await adapter.buscarRegistros(dispositivo.ultimo_nsr);
  } finally {
    await adapter.desconectar();
  }

  return { dispositivo, registros };
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  testarConexao,
  forcarColeta,
  sanitizar,
};
