const express = require('express');
const auditoriaController = require('./auditoria.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

// Logs de auditoria sao imutaveis: este modulo expoe apenas leitura.
router.use(
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('auditoria', 'ver')
);

router.get('/', auditoriaController.listar);
router.get('/:id', auditoriaController.buscar);

module.exports = router;
