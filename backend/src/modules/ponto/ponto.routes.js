const express = require('express');
const pontoController = require('./ponto.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');
const { exigirPermissao } = require('../../middlewares/permissions');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/apontamentos', exigirPermissao('ponto', 'ver'), pontoController.listarApontamentos);
router.post('/apontamentos/processar', exigirPermissao('ponto', 'atualizar'), pontoController.processarDia);
router.get('/registros/nao-resolvidos', exigirPermissao('ponto', 'ver'), pontoController.listarNaoResolvidos);
router.get('/registros/alunos', exigirPermissao('ponto', 'ver'), pontoController.listarRegistrosAlunos);
router.post('/registros/manual', exigirPermissao('ponto', 'adicionar'), pontoController.registrarBatidaManual);
router.get('/registros/:id/foto', exigirPermissao('ponto', 'ver'), pontoController.obterFoto);

router.get('/banco-horas/:funcionarioId/extrato', exigirPermissao('ponto', 'ver'), pontoController.extratoBancoHoras);
router.post(
  '/banco-horas/lancamento-manual',
  exigirPermissao('ponto', 'adicionar'),
  pontoController.lancamentoManualBancoHoras
);

module.exports = router;
