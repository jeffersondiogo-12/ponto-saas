const express = require('express');
const dispositivosController = require('./dispositivos.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', dispositivosController.listar);
router.get('/:id', dispositivosController.buscar);
router.post('/', exigirPapel('super_admin', 'admin'), dispositivosController.criar);
router.put('/:id', exigirPapel('super_admin', 'admin'), dispositivosController.atualizar);
router.post('/:id/testar-conexao', exigirPapel('super_admin', 'admin'), dispositivosController.testarConexao);
router.post('/:id/forcar-coleta', exigirPapel('super_admin', 'admin'), dispositivosController.forcarColeta);

module.exports = router;
