const express = require('express');
const empresasController = require('./empresas.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'));

// Listar/criar empresas e operacao de plataforma (apenas super_admin).
router.get('/', exigirPermissao('empresas', 'ver'), empresasController.listar);
router.post('/', exigirPermissao('empresas', 'adicionar'), empresasController.criar);

// Ver/editar a propria empresa e permitido para admin/rh tambem.
router.get('/:id', exigirPermissao('empresas', 'ver'), empresasController.buscar);
router.put('/:id', exigirPermissao('empresas', 'atualizar'), empresasController.atualizar);
router.delete('/:id', exigirPermissao('empresas', 'deletar'), empresasController.excluir);

module.exports = router;
