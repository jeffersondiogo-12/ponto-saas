const express = require('express');
const authController = require('./auth.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');
const { exigirPermissao } = require('../../middlewares/permissions');

const router = express.Router();

router.post('/login', authController.login);

router.get('/usuarios', autenticar, exigirTipo('staff'), resolverTenant, exigirPermissao('usuarios', 'ver'), authController.listarUsuarios);
router.post(
  '/usuarios',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('usuarios', 'adicionar'),
  authController.criarUsuario
);

module.exports = router;
