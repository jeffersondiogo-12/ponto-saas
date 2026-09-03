const express = require('express');
const controller = require('./professores.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();
const staff = [autenticar, exigirTipo('staff'), resolverTenant];

router.get('/minhas-turmas', ...staff, exigirPermissao('professores', 'ver'), exigirPapel('professor'), controller.minhasTurmas);
router.get('/minhas-turmas/resumo', ...staff, exigirPermissao('professores', 'ver'), exigirPapel('professor'), controller.resumoMinhasTurmas);
router.get('/turmas/:turmaId/alunos', ...staff, exigirPermissao('professores', 'ver'), exigirPapel('professor'), controller.alunosDaTurma);
router.get('/turmas/:turmaId/grade', ...staff, exigirPermissao('professores', 'ver'), exigirPapel('professor', 'gestor', 'admin', 'super_admin'), controller.listarGrade);
router.post('/turmas/:turmaId/presencas', ...staff, exigirPermissao('professores', 'atualizar'), exigirPapel('professor', 'gestor', 'admin', 'super_admin'), controller.registrarPresencas);
router.post('/turmas/:turmaId/notas', ...staff, exigirPermissao('professores', 'adicionar'), exigirPapel('professor'), controller.criarNota);
router.post('/turmas/:turmaId/observacoes', ...staff, exigirPermissao('professores', 'adicionar'), exigirPapel('professor'), controller.criarObservacao);
router.get('/turmas/:turmaId/alunos/:alunoId/historico', ...staff, exigirPermissao('professores', 'ver'), exigirPapel('professor'), controller.historicoDoAluno);

router.get('/turmas/:turmaId/professores', ...staff, exigirPermissao('professores', 'ver'), exigirPapel('super_admin', 'admin', 'gestor'), controller.listarProfessores);
router.post('/turmas/:turmaId/professores', ...staff, exigirPermissao('professores', 'adicionar'), exigirPapel('super_admin', 'admin', 'gestor'), controller.atribuirProfessor);

module.exports = router;
