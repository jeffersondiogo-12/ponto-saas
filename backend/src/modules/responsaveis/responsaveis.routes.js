const express = require('express');
const responsaveisController = require('./responsaveis.controller');
const { autenticar, exigirTipo, exigirPapel } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

// --- Publicas (usadas pelo app dos pais) ---
router.post('/cadastro', responsaveisController.cadastrar);
router.post('/login', responsaveisController.login);

// --- Autenticadas como responsavel (app dos pais) ---
router.get('/alunos', autenticar, exigirTipo('responsavel'), responsaveisController.listarAlunos);
router.get(
  '/alunos/:alunoId/frequencia',
  autenticar,
  exigirTipo('responsavel'),
  responsaveisController.frequenciaDoAluno
);
router.get(
  '/alunos/:alunoId/notas',
  autenticar,
  exigirTipo('responsavel'),
  responsaveisController.notasDoAluno
);
router.get(
  '/alunos/:alunoId/observacoes',
  autenticar,
  exigirTipo('responsavel'),
  responsaveisController.observacoesDoAluno
);
router.post('/alunos/vincular', autenticar, exigirTipo('responsavel'), responsaveisController.vincularNovoFilho);
router.get(
  '/alunos/:alunoId/presenca-sala',
  autenticar,
  exigirTipo('responsavel'),
  responsaveisController.presencaSalaDoAluno
);
router.get('/alunos/:alunoId/avisos', autenticar, exigirTipo('responsavel'), responsaveisController.avisosDoAluno);
router.post('/push-token', autenticar, exigirTipo('responsavel'), responsaveisController.registrarPushToken);

// --- Autenticada como staff (a escola vincula um responsavel a um aluno) ---
router.post(
  '/vincular',
  autenticar,
  exigirTipo('gestor'),
  resolverTenant,
  exigirPapel('super_admin', 'admin', 'gestor'),
  responsaveisController.vincularAluno
);

router.delete(
  '/:id',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPapel('super_admin', 'admin', 'rh'),
  responsaveisController.excluir
);

module.exports = router;
