const express = require('express');
const chamadasController = require('./chamadas.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, resolverTenant);

router.get('/', exigirTipo('staff'), chamadasController.listar);
router.get('/alunos', exigirTipo('staff'), chamadasController.listarAlunos);
router.post('/presenca', exigirTipo('staff'), chamadasController.marcarPresenca);
router.post('/salvar', exigirTipo('staff'), chamadasController.salvarChamada);

module.exports = router;
