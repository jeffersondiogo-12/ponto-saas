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
router.post('/push-token', autenticar, exigirTipo('responsavel'), responsaveisController.registrarPushToken);

// --- Autenticada como staff (a escola vincula um responsavel a um aluno) ---
router.post(
  '/vincular',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPapel('super_admin', 'admin', 'rh'),
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
