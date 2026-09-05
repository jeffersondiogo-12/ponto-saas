const express = require('express');
const controller = require('./permissoes.controller');
const { autenticar, exigirTipo, exigirPapel } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

// Minhas proprias permissoes (qualquer staff logado - usado pelo front pra
// esconder/mostrar botao de menu, etc). Fica como estava.
router.get('/', autenticar, exigirTipo('staff'), resolverTenant, controller.listar);

// A partir daqui: tela do super_admin pra gerir permissao de cargo e de
// usuario individual. exigirPapel('super_admin') ja barra qualquer outro
// papel - so super_admin decide essas regras.
const somenteSuperAdmin = [autenticar, exigirTipo('staff'), resolverTenant, exigirPapel('super_admin')];

// Padrao por cargo (a regra geral - "todo gestor pode X").
router.get('/papeis', ...somenteSuperAdmin, controller.listarMatrizPapeis);
router.put('/papeis/:papel', ...somenteSuperAdmin, controller.definirPermissaoPapel);

// Excecao por pessoa (sobrescreve o cargo so pra aquele usuario).
router.get('/usuarios/:usuarioId', ...somenteSuperAdmin, controller.listarEfetivoPorUsuario);
router.put('/usuarios/:usuarioId', ...somenteSuperAdmin, controller.definirOverrideUsuario);
router.delete('/usuarios/:usuarioId', ...somenteSuperAdmin, controller.removerOverrideUsuario);

module.exports = router;
