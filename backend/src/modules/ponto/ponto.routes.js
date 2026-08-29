const express = require('express');
const pontoController = require('./ponto.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/apontamentos', pontoController.listarApontamentos);
router.post('/apontamentos/processar', exigirPapel('super_admin', 'admin', 'rh'), pontoController.processarDia);
router.get('/registros/nao-resolvidos', exigirPapel('super_admin', 'admin', 'rh'), pontoController.listarNaoResolvidos);
router.get('/registros/alunos', exigirPapel('super_admin', 'admin', 'gestor', 'rh'), pontoController.listarRegistrosAlunos);
router.post('/registros/manual', exigirPapel('super_admin', 'admin', 'rh'), pontoController.registrarBatidaManual);
router.get('/registros/:id/foto', pontoController.obterFoto);

router.get('/banco-horas/:funcionarioId/extrato', pontoController.extratoBancoHoras);
router.post(
  '/banco-horas/lancamento-manual',
  exigirPapel('super_admin', 'admin', 'rh'),
  pontoController.lancamentoManualBancoHoras
);

module.exports = router;
