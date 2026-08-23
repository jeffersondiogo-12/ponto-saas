/**
 * Simula um equipamento Evo Facial conversando com este backend, seguindo o
 * protocolo real (PDF "Protocolo WebSocket EVO FACIAL - Revisao 5"). Util
 * para testar a integracao de ponta a ponta sem depender do hardware fisico
 * - tanto para desenvolvimento quanto para validar uma instalacao nova.
 *
 * Uso:
 *   node scripts/simular-evo-facial.js [opcoes]
 *
 * Opcoes:
 *   --host=localhost          Host do backend (padrao: localhost)
 *   --porta=3000              Porta do backend - a MESMA da API, nao uma porta separada (padrao: PORT do .env, ou 3000)
 *   --sn=EVOFACIAL0001        Numero de serie a simular (precisa existir em `dispositivos`, protocolo=evo_ws)
 *   --enrollid=1              enrollid a usar na batida simulada
 *   --bater-ponto             Envia um sendlog com uma marcacao (inout=0) 2s apos o registro
 *   --responder-comandos      Fica ouvindo e respondendo setuserinfo/deleteuser/getuserlist/getnewlog vindos do servidor (Ctrl+C para sair)
 *
 * Exemplos:
 *   node scripts/simular-evo-facial.js --sn=EVOFACIAL0001 --bater-ponto
 *   node scripts/simular-evo-facial.js --sn=EVOFACIAL0001 --responder-comandos
 */
require('dotenv').config();
const WebSocket = require('ws');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [chave, valor] = a.replace(/^--/, '').split('=');
    return [chave, valor === undefined ? true : valor];
  })
);

const HOST = args.host || 'localhost';
// O WebSocket compartilha a MESMA porta HTTP da API (nao uma porta
// separada) - ver server.js/evoFacialServidor.js. Por padrao usa PORT
// (a mesma que "npm run dev" sobe a API), nao mais EVO_FACIAL_WS_PORT.
const PORTA = Number(args.porta) || Number(process.env.PORT) || 3000;
const SN = args.sn || 'EVOFACIAL0001';
const ENROLLID = Number(args.enrollid) || 1;

const url = `ws://${HOST}:${PORTA}`;
console.log(`[simulador] conectando em ${url} como sn="${SN}"...`);
const ws = new WebSocket(url);

function formatarAgora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// 1x1 px JPEG preto, só pra ter algo decodificável em Base64 nos testes de foto.
const FOTO_FAKE_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

ws.on('open', () => {
  ws.send(
    JSON.stringify({
      cmd: 'reg',
      sn: SN,
      devinfo: {
        modelname: 'AiFace',
        usersize: 5000,
        facesize: 5000,
        fpsize: 0,
        cardsize: 5000,
        pwdsize: 5000,
        logsize: 500000,
        useduser: 1,
        usedface: 1,
        usedlog: 0,
        usednewlog: 0,
        netinuse: 1,
        usb4g: 0,
        fpalgo: 'thbio3.0',
        firmware: 'simulador-v1.0',
        time: formatarAgora(),
        curip: '192.168.15.42',
        mac: '00-01-A9-SI-MU-01',
      },
    })
  );
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  console.log('[simulador] recebido:', JSON.stringify(msg));

  if (msg.ret === 'reg') {
    if (!msg.result) {
      console.error(`[simulador] registro recusado: ${msg.reason}. Verifique se existe um dispositivo com numero_serie="${SN}" e protocolo="evo_ws" cadastrado.`);
      if (!args['responder-comandos']) process.exit(1);
      return;
    }
    console.log('[simulador] registrado com sucesso.');
    if (args['bater-ponto']) {
      setTimeout(() => {
        const payload = {
          cmd: 'sendlog',
          sn: SN,
          count: 1,
          logindex: 0,
          record: [
            {
              enrollid: ENROLLID,
              time: formatarAgora(),
              mode: 0,
              inout: 0,
              event: 0,
              verifymode: 15, // face
            },
          ],
        };
        console.log('[simulador] enviando batida:', JSON.stringify(payload));
        ws.send(JSON.stringify(payload));
      }, 1000);
    }
    return;
  }

  if (msg.ret === 'sendlog') {
    console.log(`[simulador] batida ${msg.result ? 'confirmada' : 'recusada'} pelo servidor.`);
    if (!args['responder-comandos']) {
      setTimeout(() => process.exit(0), 300);
    }
    return;
  }

  // Comandos que o SERVIDOR manda pra gente (secao 2 do protocolo) - so
  // responde se --responder-comandos foi passado, simulando o firmware
  // aceitando o comando.
  if (!args['responder-comandos']) return;

  switch (msg.cmd) {
    case 'setuserinfo':
      console.log(`[simulador] cadastrando face localmente: enrollid=${msg.enrollid}, nome="${msg.name}"`);
      ws.send(JSON.stringify({ ret: 'setuserinfo', result: true }));
      break;
    case 'deleteuser':
      console.log(`[simulador] removendo enrollid=${msg.enrollid}`);
      ws.send(JSON.stringify({ ret: 'deleteuser', result: true }));
      break;
    case 'getuserlist':
      ws.send(
        JSON.stringify({
          ret: 'getuserlist',
          result: true,
          count: 1,
          from: 0,
          to: 0,
          record: [{ enrollid: ENROLLID, admin: 0, backupnum: 50 }],
        })
      );
      break;
    case 'getnewlog':
      ws.send(
        JSON.stringify({
          ret: 'getnewlog',
          result: true,
          count: 0,
          from: 0,
          to: 0,
          record: [],
        })
      );
      break;
    default:
      console.log(`[simulador] comando "${msg.cmd}" nao simulado, ignorando.`);
  }
});

ws.on('error', (err) => {
  console.error('[simulador] erro de conexao:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('[simulador] conexao encerrada.');
});

if (args['responder-comandos']) {
  console.log('[simulador] modo "responder-comandos" ativo - mantendo conexao aberta (Ctrl+C para sair).');
}

module.exports = { FOTO_FAKE_BASE64 };
