require('dotenv').config();
const db = require('../config/db');
const avisosService = require('../modules/avisos/avisos.service');

const INTERVALO_MS = (Number(process.env.AVISOS_INTERVALO_MINUTOS) || 1) * 60 * 1000;

async function processar() {
  const quantidade = await avisosService.processarPendentes();
  if (quantidade) console.log(`[avisos] ${quantidade} aviso(s) processado(s)`);
}

async function iniciar() {
  console.log(`[avisos] worker iniciado, intervalo de ${INTERVALO_MS / 60000} min`);
  await processar();
  setInterval(processar, INTERVALO_MS);
}

if (require.main === module) iniciar().catch((err) => {
  console.error('[avisos] worker finalizado com erro:', err);
  process.exitCode = 1;
});

module.exports = { processar, iniciar };