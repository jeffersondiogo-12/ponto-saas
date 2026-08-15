const express = require('express');
const professoresController = require('./professores.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.post('/login', professoresController.login);

router.use(autenticar, resolverTenant);

router.get('/me/turmas', exigirTipo('professor'), professoresController.listarMinhasTurmas);
router.get('/', exigirTipo('staff'), professoresController.listar);
router.get('/:id', exigirTipo('staff'), professoresController.buscar);
router.get('/:id/turmas', exigirTipo('staff'), professoresController.listarTurmas);
router.post('/', exigirTipo('staff'), exigirPapel('super_admin', 'admin', 'rh'), professoresController.criar);
router.put('/:id', exigirPapel('super_admin', 'admin', 'rh'), professoresController.atualizar);
router.post('/:id/turmas', exigirPapel('super_admin', 'admin', 'rh'), professoresController.vincularTurma);

module.exports = router;
