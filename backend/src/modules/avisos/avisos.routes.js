const express = require('express');
const controller = require('./avisos.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();
const staff = [autenticar, exigirTipo('staff'), resolverTenant];

// Leitura pelos responsaveis fica em responsaveis.routes.js (avisosDoAluno),
// ja escopada por aluno/filial. Aqui e so a gestao do mural pelo staff.
router.get('/', ...staff, exigirPermissao('avisos', 'ver'), controller.listar);
router.get('/:id', ...staff, exigirPermissao('avisos', 'ver'), controller.buscar);
router.post('/', ...staff, exigirPermissao('avisos', 'adicionar'), controller.criar);
router.put('/:id', ...staff, exigirPermissao('avisos', 'atualizar'), controller.atualizar);
router.delete('/:id', ...staff, exigirPermissao('avisos', 'deletar'), controller.remover);
router.patch('/:id/ativar', ...staff, exigirPermissao('avisos', 'atualizar'), controller.ativar);
router.patch('/:id/desativar', ...staff, exigirPermissao('avisos', 'atualizar'), controller.desativar);

module.exports = router;
