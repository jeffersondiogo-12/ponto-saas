const express = require('express');
const controller = require('./avisos.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();
const staffGestao = [
	autenticar,
	exigirTipo('staff'),
	resolverTenant,
	exigirPapel('admin', 'super_admin'),
];

// Leitura pelos responsaveis fica em responsaveis.routes.js (avisosDoAluno),
// ja escopada por aluno/filial. Aqui e so a gestao do mural pelo staff.
router.get('/', ...staffGestao, exigirPermissao('avisos', 'ver'), controller.listar);
router.get('/:id', ...staffGestao, exigirPermissao('avisos', 'ver'), controller.buscar);
router.post('/', ...staffGestao, exigirPermissao('avisos', 'adicionar'), controller.criar);
router.put('/:id', ...staffGestao, exigirPermissao('avisos', 'atualizar'), controller.atualizar);
router.delete('/:id', ...staffGestao, exigirPermissao('avisos', 'deletar'), controller.remover);
router.patch('/:id/ativar', ...staffGestao, exigirPermissao('avisos', 'atualizar'), controller.ativar);
router.patch('/:id/desativar', ...staffGestao, exigirPermissao('avisos', 'atualizar'), controller.desativar);
router.post('/:id/duplicar', ...staffGestao, exigirPermissao('avisos', 'adicionar'), controller.duplicar);

module.exports = router;
