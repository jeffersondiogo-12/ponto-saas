const express = require('express');
const alunosController = require('./alunos.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', exigirPermissao('alunos', 'ver'), alunosController.listar);
router.get('/:id', exigirPermissao('alunos', 'ver'), alunosController.buscar);
router.get('/:id/frequencia', exigirPermissao('alunos', 'ver'), alunosController.frequencia);
router.post('/', exigirPermissao('alunos', 'adicionar'), alunosController.criar);
router.put('/:id', exigirPermissao('alunos', 'atualizar'), alunosController.atualizar);
router.delete('/:id', exigirPermissao('alunos', 'deletar'), alunosController.excluir);
router.post('/:id/dispositivos', exigirPermissao('alunos', 'atualizar'), alunosController.vincularDispositivo);

module.exports = router;
