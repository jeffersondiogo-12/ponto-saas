const express = require('express');
const dispositivosController = require('./dispositivos.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', exigirPermissao('dispositivos', 'ver'), dispositivosController.listar);
router.get('/:id', exigirPermissao('dispositivos', 'ver'), dispositivosController.buscar);
router.post('/', exigirPermissao('dispositivos', 'adicionar'), dispositivosController.criar);
router.put('/:id', exigirPermissao('dispositivos', 'atualizar'), dispositivosController.atualizar);
router.post('/:id/testar-conexao', exigirPermissao('dispositivos', 'atualizar'), dispositivosController.testarConexao);
router.post('/:id/forcar-coleta', exigirPermissao('dispositivos', 'atualizar'), dispositivosController.forcarColeta);
router.get(
  '/:id/usuarios-no-equipamento',
  exigirPermissao('dispositivos', 'ver'),
  dispositivosController.usuariosNoEquipamento
);
router.post(
  '/:id/cadastrar-face',
  exigirPermissao('dispositivos', 'atualizar'),
  dispositivosController.cadastrarFace
);
router.post('/:id/remover-face', exigirPermissao('dispositivos', 'atualizar'), dispositivosController.removerFace);

module.exports = router;
