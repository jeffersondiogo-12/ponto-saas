const express = require('express');
const responsaveisController = require('./responsaveis.controller');
const { autenticar, exigirTipo, exigirPapel } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
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
router.post('/pedidos-vinculo', autenticar, exigirTipo('responsavel'), responsaveisController.vincularNovoFilho);
router.get('/meus-pedidos-vinculo', autenticar, exigirTipo('responsavel'), responsaveisController.listarMeusPedidosVinculo);
router.get(
  '/alunos/:alunoId/presenca-sala',
  autenticar,
  exigirTipo('responsavel'),
  responsaveisController.presencaSalaDoAluno
);
router.get('/alunos/:alunoId/avisos', autenticar, exigirTipo('responsavel'), responsaveisController.avisosDoAluno);
router.post('/avisos/:avisoId/lido', autenticar, exigirTipo('responsavel'), responsaveisController.registrarLeituraAviso);
router.post('/push-token', autenticar, exigirTipo('responsavel'), responsaveisController.registrarPushToken);
router.post('/push-web', autenticar, exigirTipo('responsavel'), responsaveisController.registrarPushWeb);
router.delete('/push-web', autenticar, exigirTipo('responsavel'), responsaveisController.removerPushWeb);

// --- Autenticada como staff (a escola vincula um responsavel a um aluno) ---
router.post(
  '/vincular',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('responsaveis', 'adicionar'),
  responsaveisController.vincularAluno
);

router.get(
  '/',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('responsaveis', 'ver'),
  responsaveisController.listarResponsaveisDaEmpresa
);

router.patch(
  '/:responsavelId',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('responsaveis', 'atualizar'),
  responsaveisController.atualizarResponsavelDaEmpresa
);

router.get(
  '/admin/notificacoes-vinculo',
  autenticar,
  exigirTipo('staff'),
  exigirPapel('admin', 'gestor'),
  resolverTenant,
  responsaveisController.listarNotificacoesVinculo
);

router.get(
  '/admin/pedidos-vinculo',
  autenticar,
  exigirTipo('staff'),
  exigirPapel('admin', 'gestor'),
  resolverTenant,
  exigirPermissao('responsaveis', 'ver'),
  responsaveisController.listarPedidosVinculo
);

router.post(
  '/admin/pedidos-vinculo/:pedidoId/:decisao',
  autenticar,
  exigirTipo('staff'),
  exigirPapel('admin', 'gestor'),
  resolverTenant,
  (req, res, next) => {
    const acao = req.params.decisao === 'aprovado' ? 'adicionar' : 'atualizar';
    return exigirPermissao('responsaveis', acao)(req, res, next);
  },
  responsaveisController.decidirPedidoVinculo
);

router.get(
  '/alunos/:alunoId/responsaveis',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('responsaveis', 'ver'),
  responsaveisController.listarResponsaveisDoAluno
);

router.post(
  '/alunos/:alunoId/vincular-responsavel',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('responsaveis', 'adicionar'),
  responsaveisController.vincularResponsavelAoAluno
);

router.patch(
  '/alunos/:alunoId/responsaveis/:responsavelId',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('responsaveis', 'atualizar'),
  responsaveisController.atualizarContaResponsavel
);

router.delete(
  '/:id',
  autenticar,
  exigirTipo('staff'),
  resolverTenant,
  exigirPermissao('responsaveis', 'deletar'),
  responsaveisController.excluir
);

module.exports = router;
