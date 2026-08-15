const express = require('express');
const funcionariosController = require('./funcionarios.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', funcionariosController.listar);
router.get('/:id', funcionariosController.buscar);
router.post('/', exigirPapel('super_admin', 'admin', 'rh'), funcionariosController.criar);
router.put('/:id', exigirPapel('super_admin', 'admin', 'rh'), funcionariosController.atualizar);
router.post(
  '/:id/dispositivos',
  exigirPapel('super_admin', 'admin', 'rh'),
  funcionariosController.vincularDispositivo
);

module.exports = router;
