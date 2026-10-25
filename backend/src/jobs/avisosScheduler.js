require('dotenv').config();
const db = require('../config/db');
const avisosService = require('../modules/avisos/avisos.service');

const INTERVALO_MS = (Number(process.env.AVISOS_INTERVALO_MINUTOS) || 1) * 60 * 1000;
let processando = false;

async function processar() {
  if (processando) return;
  processando = true;
  try {
    const quantidade = await avisosService.processarPendentes();
    if (quantidade) console.log(`[avisos] ${quantidade} aviso(s) processado(s)`);
  } finally {
    processando = false;
  }
}

function processarComLogDeErro() {
  processar().catch((err) => {
    console.error('[avisos] falha ao processar agendamentos:', err);
  });
}

async function iniciar() {
  console.log(`[avisos] worker iniciado, intervalo de ${INTERVALO_MS / 60000} min`);
  const intervalo = setInterval(processarComLogDeErro, INTERVALO_MS);
  processarComLogDeErro();
  return intervalo;
}

if (require.main === module) iniciar().catch((err) => {
  console.error('[avisos] worker finalizado com erro:', err);
  process.exitCode = 1;
});

module.exports = { processar, iniciar };