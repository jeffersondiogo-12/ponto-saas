const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { encrypt, decrypt } = require('../../utils/crypto');
const { criarAdapter } = require('./adapters');
const evoFacialServidor = require('./evoFacialServidor');
// Reaproveita o vinculo ja implementado em cada modulo de pessoa, em vez de
// duplicar o upsert de funcionario_dispositivos/aluno_dispositivos aqui.
const funcionariosService = require('../funcionarios/funcionarios.service');
const alunosService = require('../alunos/alunos.service');

const TABELA_VINCULO = { funcionario: 'funcionario_dispositivos', aluno: 'aluno_dispositivos' };
const COLUNA_PESSOA = { funcionario: 'funcionario_id', aluno: 'aluno_id' };

// Nunca deixamos a senha (cifrada ou nao) sair para a API/tela.
function sanitizar(dispositivo) {
  if (!dispositivo) return dispositivo;
  const ultimaComunicacao = dispositivo.ultima_conexao_ws_em ? new Date(dispositivo.ultima_conexao_ws_em).getTime() : 0;
  const comunicouRecentemente = ultimaComunicacao > 0 && Date.now() - ultimaComunicacao <= 60 * 1000;
  const { senha_dispositivo_cifrada, ...resto } = dispositivo;
  return {
    ...resto,
    senha_configurada: Boolean(senha_dispositivo_cifrada),
    // So faz sentido pra dispositivos 'server' (o equipamento e quem se
    // conecta) - fica null pros demais, em vez de sempre false, para nao
    // sugerir "desconectado" num protocolo onde essa nocao nem existe.
    conectado_agora:
      dispositivo.protocolo === 'evo_ws'
        ? evoFacialServidor.estaConectado(dispositivo.numero_serie) || comunicouRecentemente
        : null,
  };
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

/** Lista o que o EQUIPAMENTO acha que tem cadastrado (reconciliacao com o nosso banco). */
async function listarUsuariosNoEquipamento(empresaId, dispositivoId) {
  const adapter = await obterAdapter(empresaId, dispositivoId);
  return adapter.listarUsuarios();
}

/**
 * Cadastra o rosto de um funcionario/aluno diretamente no equipamento (sem
 * precisar ir ate ele fisicamente) e, se o equipamento confirmar, ja cria o
 * vinculo em funcionario_dispositivos/aluno_dispositivos com o enrollId
 * devolvido - substitui os dois passos manuais que o sistema exigia ate
 * aqui (cadastrar no equipamento + POST /:id/dispositivos) por um so.
 * So funciona com protocolos que suportam cadastro remoto (ver
 * DeviceAdapter.cadastrarFace) - hoje, so evo_ws.
 */
async function cadastrarFace(empresaId, dispositivoId, { tipo, pessoaId, idNoDispositivo, nome, fotoBase64 }) {
  if (!TABELA_VINCULO[tipo]) throw new AppError('tipo deve ser "funcionario" ou "aluno".', 400);
  if (!idNoDispositivo) throw new AppError('idNoDispositivo (enrollId no equipamento) e obrigatorio.', 400);

  const adapter = await obterAdapter(empresaId, dispositivoId);
  const resultado = await adapter.cadastrarFace({ enrollId: idNoDispositivo, nome, fotoBase64 });

  if (tipo === 'funcionario') {
    await funcionariosService.vincularDispositivo(empresaId, pessoaId, dispositivoId, resultado.enrollId);
  } else {
    await alunosService.vincularDispositivo(empresaId, pessoaId, dispositivoId, resultado.enrollId);
  }

  return { enrollId: resultado.enrollId };
}

/** Remove a face do equipamento e desfaz o vinculo local, nessa ordem (so desvincula se o equipamento confirmar). */
async function removerFace(empresaId, dispositivoId, { tipo, pessoaId }) {
  const tabela = TABELA_VINCULO[tipo];
  if (!tabela) throw new AppError('tipo deve ser "funcionario" ou "aluno".', 400);

  await buscarPorId(empresaId, dispositivoId); // valida que o dispositivo e desta empresa

  const vinculo = await db(tabela).where({ dispositivo_id: dispositivoId, [COLUNA_PESSOA[tipo]]: pessoaId }).first();
  if (!vinculo) throw new AppError('Este funcionario/aluno nao esta vinculado a este dispositivo.', 404);

  const adapter = await obterAdapter(empresaId, dispositivoId);
  await adapter.removerFace(vinculo.id_no_dispositivo);

  await db(tabela).where({ id: vinculo.id }).del();
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  testarConexao,
  forcarColeta,
  sanitizar,
  listarUsuariosNoEquipamento,
  cadastrarFace,
  removerFace,
};
