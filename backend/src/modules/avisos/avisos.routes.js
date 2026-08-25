const express = require('express');
const controller = require('./avisos.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();
const staff = [autenticar, exigirTipo('staff'), resolverTenant];
const gestao = exigirPapel('super_admin', 'admin', 'gestor');

// Leitura pelos responsaveis fica em responsaveis.routes.js (avisosDoAluno),
// ja escopada por aluno/filial. Aqui e so a gestao do mural pelo staff.
router.get('/', ...staff, gestao, controller.listar);
router.post('/', ...staff, gestao, controller.criar);
router.patch('/:id/ativar', ...staff, gestao, controller.ativar);
router.patch('/:id/desativar', ...staff, gestao, controller.desativar);

module.exports = router;
