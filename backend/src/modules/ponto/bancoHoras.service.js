const db = require('../../config/db');

/**
 * Le o ultimo saldo acumulado do funcionario (0 se nunca houve lancamento).
 * Sempre le do ledger, nunca de um campo "saldo atual" cacheado em
 * funcionarios - isso elimina uma classe inteira de bug de saldo divergente.
 */
async function obterSaldoAtual(funcionarioId, trx = db) {
  const ultimo = await trx('banco_horas_lancamentos')
    .where({ funcionario_id: funcionarioId })
    .orderBy('id', 'desc')
    .first();
  return ultimo ? ultimo.saldo_acumulado_apos : 0;
}

/**
 * Registra um lancamento no banco de horas ligado a um apontamento diario
 * (credito se saldo do dia > 0, debito se < 0). So lanca quando o horario de
 * trabalho do funcionario tem um acordo de banco de horas configurado -
 * sem acordo, o saldo do dia normalmente vira hora extra paga ou falta
 * descontada em folha, nao banco de horas (CLT art.59 §2).
 *
 * Idempotente em relacao a REPROCESSAMENTO do mesmo dia: se o apontamento ja
 * gerou lancamento(s) antes (ex: o dia foi recalculado depois de uma batida
 * chegar atrasada), lanca so a DIFERENCA entre o saldo novo e o que ja
 * constava - nunca duplica o credito/debito. O ledger continua append-only
 * (nunca apaga o lancamento anterior), so soma um registro de ajuste.
 */
async function lancarPorApontamento(trx, { empresaId, funcionarioId, apontamentoDiarioId, dataReferencia, saldoMinutosDoDia }) {
  const jaLancado = await trx('banco_horas_lancamentos')
    .where({ apontamento_diario_id: apontamentoDiarioId })
    .sum({ total: 'minutos' })
    .first();
  const totalJaLancado = Number(jaLancado?.total) || 0;

  const delta = saldoMinutosDoDia - totalJaLancado;
  if (delta === 0) return null;

  const saldoAnterior = await obterSaldoAtual(funcionarioId, trx);
  const saldoNovo = saldoAnterior + delta;

  const [lancamento] = await trx('banco_horas_lancamentos')
    .insert({
      empresa_id: empresaId,
      funcionario_id: funcionarioId,
      data_referencia: dataReferencia,
      tipo: delta >= 0 ? 'credito' : 'debito',
      minutos: delta,
      saldo_acumulado_apos: saldoNovo,
      apontamento_diario_id: apontamentoDiarioId,
      observacao: totalJaLancado !== 0 ? 'Ajuste por reprocessamento do apontamento diario.' : null,
    })
    .returning('*');

  return lancamento;
}

async function lancamentoManual(empresaId, { funcionarioId, minutos, observacao, criadoPorUsuarioId }) {
  return db.transaction(async (trx) => {
    const saldoAnterior = await obterSaldoAtual(funcionarioId, trx);
    const saldoNovo = saldoAnterior + Number(minutos);

    const [lancamento] = await trx('banco_horas_lancamentos')
      .insert({
        empresa_id: empresaId,
        funcionario_id: funcionarioId,
        data_referencia: new Date(),
        tipo: 'ajuste_manual',
        minutos: Number(minutos),
        saldo_acumulado_apos: saldoNovo,
        observacao,
        criado_por_usuario_id: criadoPorUsuarioId,
      })
      .returning('*');

    return lancamento;
  });
}

async function extrato(empresaId, funcionarioId, { de, ate } = {}) {
  const query = db('banco_horas_lancamentos')
    .where({ empresa_id: empresaId, funcionario_id: funcionarioId })
    .orderBy('data_referencia', 'desc')
    .orderBy('id', 'desc');

  if (de) query.where('data_referencia', '>=', de);
  if (ate) query.where('data_referencia', '<=', ate);

  return query;
}

module.exports = { obterSaldoAtual, lancarPorApontamento, lancamentoManual, extrato };
