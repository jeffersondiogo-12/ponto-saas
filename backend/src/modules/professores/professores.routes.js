const express = require('express');
const controller = require('./professores.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();
const staff = [autenticar, exigirTipo('staff'), resolverTenant];

router.get('/minhas-turmas', ...staff, exigirPapel('professor'), controller.minhasTurmas);
router.get('/minhas-turmas/resumo', ...staff, exigirPapel('professor'), controller.resumoMinhasTurmas);
router.get('/turmas/:turmaId/alunos', ...staff, exigirPapel('professor'), controller.alunosDaTurma);
router.get('/turmas/:turmaId/grade', ...staff, exigirPapel('professor', 'gestor', 'admin', 'super_admin'), controller.listarGrade);
router.post('/turmas/:turmaId/presencas', ...staff, exigirPapel('professor', 'gestor', 'admin', 'super_admin'), controller.registrarPresencas);
router.post('/turmas/:turmaId/notas', ...staff, exigirPapel('professor'), controller.criarNota);
router.post('/turmas/:turmaId/observacoes', ...staff, exigirPapel('professor'), controller.criarObservacao);
router.get('/turmas/:turmaId/alunos/:alunoId/historico', ...staff, exigirPapel('professor'), controller.historicoDoAluno);

router.get('/turmas/:turmaId/professores', ...staff, exigirPapel('super_admin', 'admin', 'gestor'), controller.listarProfessores);
router.post('/turmas/:turmaId/professores', ...staff, exigirPapel('super_admin', 'admin', 'gestor'), controller.atribuirProfessor);

module.exports = router;
