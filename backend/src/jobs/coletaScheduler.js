require('dotenv').config();
const db = require('../config/db');
const dispositivosService = require('../modules/dispositivos/dispositivos.service');
const pontoService = require('../modules/ponto/ponto.service');

const INTERVALO_MS = (Number(process.env.COLETA_INTERVALO_MINUTOS) || 5) * 60 * 1000;

/**
 * Percorre todos os dispositivos ativos com protocolo ja confirmado
 * (diferente de 'desconhecido') e executa a mesma logica do botao
 * "Forcar Coleta", automaticamente. Roda como processo separado
 * (`npm run coleta:worker`) para nao competir com o processo web.
 *
 * Dispositivos modo_conexao='server' (ex: protocolo evo_ws) ficam de fora
 * deste loop: eles NAO sao "coletados" por polling, eles mandam os dados
 * por conta propria assim que ocorrem (ver evoFacialServidor.js, rodando
 * dentro do processo web, nao aqui). Colocar esses dispositivos neste loop
 * so geraria "falha: dispositivo nao esta conectado" a cada
 * COLETA_INTERVALO_MINUTOS sempre que o equipamento estiver, por exemplo,
 * entre um ping de registro e outro - ruido sem necessidade real, ja que a
 * garantia de entrega desses dados vem do proprio equipamento reenviando
 * ate receber confirmacao (ver PDF do protocolo, secao 1.2).
 */
async function coletarTodos() {
  const dispositivos = await db('dispositivos')
    .where({ situacao: 'ativo' })
    .whereNot('protocolo', 'desconhecido')
    .whereNot('modo_conexao', 'server');

  for (const dispositivo of dispositivos) {
    try {
      const dispositivoCompleto = await dispositivosService.buscarPorId(dispositivo.empresa_id, dispositivo.id);
      const { registros } = await dispositivosService.forcarColeta(dispositivo.empresa_id, dispositivo.id);
      const resumo = await pontoService.ingerirRegistros(dispositivo.empresa_id, dispositivoCompleto, registros);
      // eslint-disable-next-line no-console
      console.log(
        `[coleta] ${dispositivo.descricao} (${dispositivo.ip}): ${resumo.totalNovos} novo(s), ${resumo.totalNaoResolvidos} sem funcionario vinculado`
      );
    } catch (err) {
      await db('dispositivos')
        .where({ id: dispositivo.id })
        .update({ ultima_coleta_status: `falha: ${err.message}`.slice(0, 250) });
      // eslint-disable-next-line no-console
      console.error(`[coleta] falha em ${dispositivo.descricao} (${dispositivo.ip}):`, err.message);
    }
  }
}

async function iniciar() {
  // eslint-disable-next-line no-console
  console.log(`[coleta] worker iniciado, intervalo de ${INTERVALO_MS / 60000} min`);
  await coletarTodos();
  setInterval(coletarTodos, INTERVALO_MS);
}

if (require.main === module) {
  iniciar();
}

module.exports = { coletarTodos };
