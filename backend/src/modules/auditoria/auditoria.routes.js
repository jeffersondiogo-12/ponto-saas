const express = require('express');
const auditoriaController = require('./auditoria.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

// Logs de auditoria sao imutaveis: este modulo expoe apenas leitura.
router.use(
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPapel('super_admin', 'admin', 'rh')
);

router.get('/', auditoriaController.listar);
router.get('/:id', auditoriaController.buscar);

module.exports = router;
