const express = require('express');
const controller = require('./professores.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();
const staff = [autenticar, exigirTipo('staff'), resolverTenant];

router.get('/minhas-turmas', ...staff, exigirPapel('professor'), controller.minhasTurmas);
router.get('/turmas/:turmaId/alunos', ...staff, exigirPapel('professor'), controller.alunosDaTurma);
router.post('/turmas/:turmaId/presencas', ...staff, exigirPapel('professor'), controller.registrarPresencas);
router.post('/turmas/:turmaId/notas', ...staff, exigirPapel('professor'), controller.criarNota);
router.post('/turmas/:turmaId/observacoes', ...staff, exigirPapel('professor'), controller.criarObservacao);

router.get('/turmas/:turmaId/professores', ...staff, exigirPapel('super_admin', 'admin', 'gestor'), controller.listarProfessores);
router.post('/turmas/:turmaId/professores', ...staff, exigirPapel('super_admin', 'admin', 'gestor'), controller.atribuirProfessor);

module.exports = router;
