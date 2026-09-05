const express = require('express');
const controller = require('./permissoes.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.get('/', autenticar, exigirTipo('staff'), resolverTenant, controller.listar);

module.exports = router;
