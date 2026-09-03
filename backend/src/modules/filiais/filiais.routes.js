const express = require('express');
const filiaisController = require('./filiais.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', exigirPermissao('filiais', 'ver'), filiaisController.listar);
router.get('/:id', exigirPermissao('filiais', 'ver'), filiaisController.buscar);
router.post('/', exigirPermissao('filiais', 'adicionar'), filiaisController.criar);
router.put('/:id', exigirPermissao('filiais', 'atualizar'), filiaisController.atualizar);
router.delete('/:id', exigirPermissao('filiais', 'deletar'), filiaisController.excluir);

module.exports = router;
