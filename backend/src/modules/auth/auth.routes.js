const express = require('express');
const authController = require('./auth.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.post('/login', authController.login);

router.get('/usuarios', autenticar, exigirTipo('staff'), resolverTenant, authController.listarUsuarios);
router.post(
  '/usuarios',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPapel('super_admin', 'admin'),
  authController.criarUsuario
);

module.exports = router;
