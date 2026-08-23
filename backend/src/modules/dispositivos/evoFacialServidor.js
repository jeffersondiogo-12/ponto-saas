const { WebSocketServer } = require('ws');
const db = require('../../config/db');
const { horaLocalParaUTC, partesNoFuso } = require('../../utils/tempo');
const { salvarFotoBatida } = require('./fotoStorage');
const pontoService = require('../ponto/ponto.service');

/**
 * ================================================================
 * Implementacao do protocolo real do equipamento, confirmado a partir do
 * PDF "Protocolo WebSocket EVO FACIAL - Revisao 5" (fabricante: Evo
 * Sistemas Inteligentes). Ao contrario do ZkProtocolAdapter (hipotese
 * nao confirmada), este arquivo segue um documento oficial do fabricante -
 * mas mesmo assim alguns pontos ficam marcados abaixo como "melhor
 * interpretacao" onde o PDF nao e 100% explicito (ex: como numerar o NSR).
 *
 * DIFERENCA FUNDAMENTAL DE ARQUITETURA vs. o adapter ZK:
 * No protocolo ZK, o SERVIDOR abre uma conexao TCP para o equipamento
 * (dispositivo.modo_conexao = 'client' - o relogio e "cliente" da rede no
 * sentido "endereco fixo que aceita conexao", mas quem fala primeiro e o
 * nosso adapter). Aqui e o INVERSO: o proprio equipamento e o WebSocket
 * client, ele que se conecta a NOS (dispositivo.modo_conexao = 'server' -
 * nos e que aceitamos, como um servidor). Por isso a coleta nao pode ser um
 * job que "sai buscando" - ela e passiva, o equipamento e quem manda os
 * dados por conta propria (ver PDF: reg a cada 20s ate ser confirmado,
 * sendlog sempre que houver marcacao nova).
 *
 * DECISAO: este servidor roda DENTRO do mesmo processo do server.js (nao
 * como worker separado tipo coleta:worker), porque o endpoint de cadastro
 * remoto de face (dispositivos.controller.js -> cadastrarFace) precisa
 * conseguir mandar um comando ("setuserinfo") para um equipamento
 * conectado AGORA, na mesma hora da requisicao HTTP - se fossem processos
 * separados, isso exigiria algum tipo de fila/IPC entre eles so pra
 * repassar um comando, complexidade que nao se paga aqui.
 * LIMITE CONHECIDO: se este backend algum dia rodar em mais de uma
 * instancia atras de um load balancer, cada instancia tera seu proprio
 * registro de conexoes em memoria (`conexoes` abaixo) - um equipamento
 * conectado na instancia A fica invisivel pra um comando disparado a
 * partir da instancia B. Nesse cenario, a solucao e sticky routing por
 * numero de serie no load balancer, ou um registro compartilhado (Redis
 * pub/sub, por exemplo) - nao implementado aqui porque o sistema roda hoje
 * como uma instancia unica.
 */

// numero_serie -> { ws, dispositivo, ultimoDevinfo, pendente }
const conexoes = new Map();

function estaConectado(numeroSerie) {
  const conexao = conexoes.get(numeroSerie);
  return Boolean(conexao && conexao.ws.readyState === conexao.ws.OPEN);
}

function listarNumerosSerieConectados() {
  return [...conexoes.keys()].filter(estaConectado);
}

/** "YYYY-MM-DD HH:MM:SS" no fuso informado - formato usado pelo protocolo em cloudtime. */
function formatarCloudTime(dataUtc, timeZone) {
  const { year, month, day, hour, minute, second } = partesNoFuso(dataUtc, timeZone);
  const p = (n) => String(n).padStart(2, '0');
  return `${year}-${p(month)}-${p(day)} ${p(hour)}:${p(minute)}:${p(second)}`;
}

/**
 * O protocolo manda horarios como "YYYY-MM-DD HH:MM:SS", sem informacao de
 * fuso. Interpretamos como hora de parede no fuso CADASTRADO do
 * dispositivo (nao o fuso do processo do servidor) - mesma logica que o
 * resto do sistema ja aplica consistentemente (ver utils/tempo.js e os
 * comentarios em ponto.service.js). O cloudtime que devolvemos no reg/
 * sendlog tambem sai formatado nesse mesmo fuso, propositalmente, para o
 * relogio interno do equipamento se manter alinhado a essa mesma
 * referencia horaria ao longo do tempo.
 */
function parseDataHoraDispositivo(textoNaive, timeZone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(textoNaive || '').trim());
  if (!m) return null;
  const [, ano, mes, dia, hora, minuto, segundo] = m.map(Number);
  const data = horaLocalParaUTC({ ano, mes, dia, hora, minuto, segundo }, timeZone);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Envia um comando ao equipamento e aguarda a resposta correlata (o
 * protocolo nao tem um ID de requisicao explicito - identificamos a
 * resposta pelo campo `ret` bater com o `cmd` que mandamos, o que so
 * funciona com um comando pendente por vez por equipamento; e exatamente
 * assim que o PDF descreve o padrao servidor->equipamento em todos os
 * exemplos da secao 2). Rejeita se o equipamento nao estiver conectado
 * agora, se ja houver outro comando em andamento, ou por timeout.
 */
async function enviarComando(numeroSerie, payload, { timeoutMs = 10000 } = {}) {
  const conexao = conexoes.get(numeroSerie);
  if (!conexao || conexao.ws.readyState !== conexao.ws.OPEN) {
    throw new Error(
      `O dispositivo "${numeroSerie}" nao esta conectado no momento. Como e o equipamento quem inicia a conexao ` +
        '(a cada 20s, quando ligado e apontando para este servidor), so e possivel enviar comandos enquanto ele estiver online.'
    );
  }
  if (conexao.pendente) {
    throw new Error('Ja existe um comando em andamento para este dispositivo - aguarde a resposta anterior.');
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      conexao.pendente = null;
      reject(new Error(`O equipamento nao respondeu ao comando "${payload.cmd}" a tempo.`));
    }, timeoutMs);

    conexao.pendente = { cmd: payload.cmd, resolve, reject, timer };

    conexao.ws.send(JSON.stringify(payload), (err) => {
      if (err) {
        clearTimeout(timer);
        conexao.pendente = null;
        reject(err);
      }
    });
  });
}

function tratarRespostaDeComando(ws, msg) {
  const conexao = ws._numeroSerie && conexoes.get(ws._numeroSerie);
  if (!conexao || !conexao.pendente || conexao.pendente.cmd !== msg.ret) return false;

  clearTimeout(conexao.pendente.timer);
  const { resolve } = conexao.pendente;
  conexao.pendente = null;
  resolve(msg);
  return true;
}

/** 1.1 Registro (PDF secao 1.1) - handshake inicial, repetido pelo equipamento a cada 20s ate ser confirmado. */
async function tratarReg(ws, msg) {
  const numeroSerie = msg.sn;
  if (!numeroSerie) {
    ws.send(JSON.stringify({ ret: 'reg', result: false, reason: 'sn ausente' }));
    return;
  }

  const dispositivo = await db('dispositivos').where({ numero_serie: numeroSerie }).first();

  if (!dispositivo) {
    // Deliberado: nao cadastramos o equipamento automaticamente so por ele
    // ter aparecido na rede - dado de ponto e sensivel demais (ver README
    // secao 5) para criar um dispositivo "as cegas". O equipamento continua
    // tentando a cada 20s (comportamento do proprio firmware), entao ha
    // tempo de sobra para um admin cadastra-lo pela tela nesse meio tempo.
    ws.send(JSON.stringify({ ret: 'reg', result: false, reason: 'dispositivo nao cadastrado' }));
    console.warn(`[evo-facial] reg recusado: numero de serie "${numeroSerie}" nao esta cadastrado em nenhuma empresa`);
    return;
  }
  if (dispositivo.situacao !== 'ativo') {
    ws.send(JSON.stringify({ ret: 'reg', result: false, reason: 'dispositivo inativo' }));
    return;
  }
  if (dispositivo.protocolo !== 'evo_ws') {
    ws.send(JSON.stringify({ ret: 'reg', result: false, reason: 'protocolo cadastrado nao e evo_ws' }));
    console.warn(
      `[evo-facial] reg recusado: "${dispositivo.descricao}" esta cadastrado com protocolo "${dispositivo.protocolo}", nao "evo_ws"`
    );
    return;
  }

  // Reconexao do mesmo equipamento (ex: reiniciou, trocou de rede): fecha a
  // sessao antiga com seguranca antes de assumir a nova.
  const conexaoAntiga = conexoes.get(numeroSerie);
  if (conexaoAntiga && conexaoAntiga.ws !== ws && conexaoAntiga.ws.readyState === conexaoAntiga.ws.OPEN) {
    conexaoAntiga.ws.terminate();
  }

  ws._numeroSerie = numeroSerie;
  conexoes.set(numeroSerie, { ws, dispositivo, ultimoDevinfo: msg.devinfo || null, pendente: null });

  const patch = {
    ultima_conexao_ws_em: db.fn.now(),
    // Reaproveita a mesma coluna que a coleta por polling usa para status -
    // para dispositivos 'server' ela passa a descrever eventos de conexao
    // em vez de ciclos de coleta (nao existe "ciclo" nesse modelo, o
    // equipamento manda quando tem algo novo).
    ultima_coleta_status: 'conectado_via_websocket',
  };
  if (msg.devinfo) patch.ultimo_devinfo = JSON.stringify(msg.devinfo);
  if (msg.devinfo?.mac && !dispositivo.mac_address) patch.mac_address = msg.devinfo.mac;

  try {
    if (msg.devinfo?.curip) patch.ip = msg.devinfo.curip;
    await db('dispositivos').where({ id: dispositivo.id }).update(patch);
  } catch (err) {
    // Um IP em formato inesperado (coluna `inet` recusando o valor) nao
    // pode impedir o registro de completar - tenta de novo sem esse campo.
    delete patch.ip;
    await db('dispositivos').where({ id: dispositivo.id }).update(patch);
  }

  const timeZone = dispositivo.fuso_horario || 'America/Sao_Paulo';
  ws.send(
    JSON.stringify({
      ret: 'reg',
      result: true,
      cloudtime: formatarCloudTime(new Date(), timeZone),
      nosenduser: true, // nao precisamos que o equipamento despeje a lista de usuarios no registro
    })
  );

  console.log(`[evo-facial] "${dispositivo.descricao}" (${numeroSerie}) registrado - firmware ${msg.devinfo?.firmware || '?'}`);
}

/** 1.2 Enviar Logs (PDF secao 1.2) - as marcacoes de ponto propriamente ditas. */
async function tratarSendlog(ws, msg) {
  const numeroSerie = ws._numeroSerie;
  const conexao = numeroSerie && conexoes.get(numeroSerie);

  if (!conexao) {
    ws.send(JSON.stringify({ ret: 'sendlog', result: false, reason: 'registre-se (reg) antes de enviar logs' }));
    return;
  }

  const dispositivoAtual = await db('dispositivos').where({ id: conexao.dispositivo.id }).first();
  const timeZone = dispositivoAtual.fuso_horario || 'America/Sao_Paulo';
  const registrosBrutos = Array.isArray(msg.record) ? msg.record : [];

  const validos = registrosBrutos
    .filter((r) => r && r.enrollid != null && r.time)
    .map((r) => ({ bruto: r, dataHora: parseDataHoraDispositivo(r.time, timeZone) }))
    .filter((r) => r.dataHora)
    // Ordena por horario antes de numerar o NSR internamente - o protocolo
    // nao garante explicitamente ordem cronologica dentro do array.
    .sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime());

  // NSR: o PDF expoe um `logindex` por LOTE (nao um indice por registro
  // dentro do array), entao nao da pra usa-lo diretamente como chave unica
  // por marcacao sem supor como o firmware numera internamente - o mesmo
  // tipo de lacuna que ja existia no protocolo ZK generico. Em vez de
  // arriscar, seguimos exatamente a mesma solucao ja adotada la
  // (ZkProtocolAdapter.buscarRegistros): geramos um NSR interno, sequencial
  // por dispositivo, a partir do `ultimo_nsr` ja persistido - o indice
  // unico (dispositivo_id, nsr) em registros_ponto garante que reenvios do
  // mesmo lote (equipamento reenviando por nao ter recebido o ack a tempo)
  // nao duplicam nada, desde que o valor de ultimo_nsr no banco nao tenha
  // avancado nesse meio tempo por outro caminho.
  const baseNsr = Number(dispositivoAtual.ultimo_nsr) || 0;

  const registrosNormalizados = [];
  for (let i = 0; i < validos.length; i += 1) {
    const { bruto, dataHora } = validos[i];
    let fotoUrl = null;
    if (bruto.image) {
      try {
        // eslint-disable-next-line no-await-in-loop
        fotoUrl = await salvarFotoBatida(dispositivoAtual.id, bruto.image);
      } catch (err) {
        console.error('[evo-facial] falha ao salvar foto da batida (marcacao segue sem foto):', err.message);
      }
    }

    registrosNormalizados.push({
      nsr: baseNsr + i + 1,
      idNoDispositivo: String(bruto.enrollid),
      dataHora,
      // `inout` e o campo de entrada/saida no uso padrao do protocolo (ver
      // normalizarTipoBatida em ponto.service.js: 0/1/2/3). Em firmwares de
      // catraca (PDF secao 3.1) o MESMO campo passa a significar
      // "direcao do giro" (5/6/7) - gravamos o valor bruto de qualquer
      // forma (nunca se perde o dado), so nao vai casar com nenhum
      // tipo_batida conhecido nesse caso (fica "indefinido"), o que e
      // seguro: nunca inventa um sentido errado pra um numero.
      tipoVerificacaoBruto: typeof bruto.inout === 'number' ? bruto.inout : null,
      fotoUrl,
      payloadBruto: bruto,
    });
  }

  let resumo;
  try {
    resumo = await pontoService.ingerirRegistros(dispositivoAtual.empresa_id, dispositivoAtual, registrosNormalizados);
  } catch (err) {
    console.error(`[evo-facial] falha ao ingerir batidas de "${dispositivoAtual.descricao}":`, err.message);
    // Responder "false" faz o equipamento tentar reenviar mais tarde -
    // sumir sem responder tambem funcionaria (o equipamento so para de
    // reenviar apos um "true"), mas um "false" explicito ajuda a
    // diagnosticar pelo log do proprio equipamento, quando ele expoe isso.
    ws.send(JSON.stringify({ ret: 'sendlog', result: false, reason: 'erro interno ao processar' }));
    return;
  }

  conexao.dispositivo = dispositivoAtual;

  ws.send(
    JSON.stringify({
      ret: 'sendlog',
      result: true,
      count: registrosBrutos.length,
      logindex: msg.logindex,
      cloudtime: formatarCloudTime(new Date(), timeZone),
      // access/message so tem efeito em equipamentos configurados como
      // "servidor valida" no menu local (PDF secao 1.2) - na maioria das
      // instalacoes (validacao offline no proprio equipamento) o
      // equipamento simplesmente ignora estes dois campos.
      access: 1,
      message: 'Ponto registrado',
    })
  );

  console.log(
    `[evo-facial] "${dispositivoAtual.descricao}": ${resumo.totalNovos} nova(s) batida(s), ${resumo.totalNaoResolvidos} sem vinculo`
  );
}

async function processarMensagem(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch (err) {
    console.warn('[evo-facial] mensagem recebida nao e JSON valido, ignorada');
    return;
  }

  if (msg.ret) {
    tratarRespostaDeComando(ws, msg);
    return;
  }

  switch (msg.cmd) {
    case 'reg':
      await tratarReg(ws, msg);
      break;
    case 'sendlog':
      await tratarSendlog(ws, msg);
      break;
    default:
      // Comandos das secoes 2.x so chegariam por aqui como eco, se o
      // equipamento reenviasse o que recebeu - nao esperado, so loga.
      console.log(`[evo-facial] comando recebido sem tratamento especifico: "${msg.cmd}"`);
  }
}

function iniciarServidorEvoFacial(alvo) {
  const compartilhado = typeof alvo === 'object';
  const wss = new WebSocketServer(compartilhado ? { noServer: true } : { port: alvo });

  if (compartilhado) {
    alvo.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname !== '/evo') return;
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    });
  }

  wss.on('connection', (ws, req) => {
    // Fila sequencial por conexao: garante que duas mensagens da MESMA
    // conexao (ex: reg seguido rapido de sendlog) sao processadas uma de
    // cada vez, na ordem - importante porque a geracao do NSR le e
    // atualiza `ultimo_nsr` no banco, e duas mensagens processadas em
    // paralelo poderiam ler o mesmo valor base e gerar NSR duplicado.
    ws._fila = Promise.resolve();
    console.log(`[evo-facial] nova conexao de ${req.socket.remoteAddress}`);

    ws.on('message', (raw) => {
      ws._fila = ws._fila.then(() => processarMensagem(ws, raw)).catch((err) => {
        console.error('[evo-facial] erro processando mensagem:', err.message);
      });
    });

    ws.on('close', () => {
      if (ws._numeroSerie && conexoes.get(ws._numeroSerie)?.ws === ws) {
        conexoes.delete(ws._numeroSerie);
        console.log(`[evo-facial] "${ws._numeroSerie}" desconectado.`);
      }
    });

    ws.on('error', (err) => {
      console.error('[evo-facial] erro na conexao:', err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('[evo-facial] erro no servidor WebSocket:', err.message);
  });

  console.log(
    compartilhado
      ? '[evo-facial] WebSocket compartilhado em /evo'
      : `[evo-facial] servidor WebSocket (protocolo Evo Facial) ouvindo na porta ${alvo}`
  );
  return wss;
}

module.exports = {
  iniciarServidorEvoFacial,
  enviarComando,
  estaConectado,
  listarNumerosSerieConectados,
};
