const express = require('express');
const filiaisController = require('./filiais.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', filiaisController.listar);
router.get('/:id', filiaisController.buscar);
router.post('/', exigirPapel('super_admin', 'admin'), filiaisController.criar);
router.put('/:id', exigirPapel('super_admin', 'admin'), filiaisController.atualizar);
router.delete('/:id', exigirPapel('super_admin', 'admin'), filiaisController.excluir);

module.exports = router;
