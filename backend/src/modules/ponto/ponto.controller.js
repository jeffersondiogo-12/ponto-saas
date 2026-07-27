const pontoService = require('./ponto.service');
const bancoHorasService = require('./bancoHoras.service');

async function registrarBatidaManual(req, res, next) {
  try {
    const registro = await pontoService.registrarBatidaManual(req.empresaId, {
      funcionarioId: req.body.funcionario_id,
      dataHora: req.body.data_hora,
      tipoBatida: req.body.tipo_batida,
      observacao: req.body.observacao,
      criadoPorUsuarioId: req.usuario.id,
    });
    res.status(201).json({ registro });
  } catch (err) {
    next(err);
  }
}

async function processarDia(req, res, next) {
  try {
    const { funcionario_id, data } = req.body;
    const apontamento = await pontoService.processarDia(req.empresaId, funcionario_id, data, req.usuario.id);
    res.json({ apontamento });
  } catch (err) {
    next(err);
  }
}

async function listarApontamentos(req, res, next) {
  try {
    const { funcionario_id, de, ate } = req.query;
    const apontamentos = await pontoService.listarApontamentos(req.empresaId, {
      funcionarioId: funcionario_id,
      de,
      ate,
    });
    res.json({ apontamentos });
  } catch (err) {
    next(err);
  }
}

async function listarNaoResolvidos(req, res, next) {
  try {
    const registros = await pontoService.listarRegistrosNaoResolvidos(req.empresaId);
    res.json({ registros });
  } catch (err) {
    next(err);
  }
}

async function extratoBancoHoras(req, res, next) {
  try {
    const { de, ate } = req.query;
    const [lancamentos, saldoAtual] = await Promise.all([
      bancoHorasService.extrato(req.empresaId, req.params.funcionarioId, { de, ate }),
      bancoHorasService.obterSaldoAtual(req.params.funcionarioId),
    ]);
    res.json({ lancamentos, saldo_atual_minutos: saldoAtual });
  } catch (err) {
    next(err);
  }
}

async function lancamentoManualBancoHoras(req, res, next) {
  try {
    const { funcionario_id, minutos, observacao } = req.body;
    const lancamento = await bancoHorasService.lancamentoManual(req.empresaId, {
      funcionarioId: funcionario_id,
      minutos,
      observacao,
      criadoPorUsuarioId: req.usuario.id,
    });
    res.status(201).json({ lancamento });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registrarBatidaManual,
  processarDia,
  listarApontamentos,
  listarNaoResolvidos,
  extratoBancoHoras,
  lancamentoManualBancoHoras,
};
