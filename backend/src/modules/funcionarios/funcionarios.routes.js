const express = require('express');
const funcionariosController = require('./funcionarios.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', exigirPermissao('funcionarios', 'ver'), funcionariosController.listar);
router.get('/:id', exigirPermissao('funcionarios', 'ver'), funcionariosController.buscar);
router.post('/', exigirPermissao('funcionarios', 'adicionar'), funcionariosController.criar);
router.put('/:id', exigirPermissao('funcionarios', 'atualizar'), funcionariosController.atualizar);
router.post(
  '/:id/dispositivos',
  exigirPermissao('funcionarios', 'atualizar'),
  funcionariosController.vincularDispositivo
);
router.delete('/:id', exigirPermissao('funcionarios', 'deletar'), funcionariosController.excluir);

module.exports = router;
