const express = require('express');
const turmasController = require('./turmas.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', turmasController.listar);
router.get('/:id', turmasController.buscar);
router.post('/', exigirPapel('super_admin', 'admin', 'rh'), turmasController.criar);
router.put('/:id', exigirPapel('super_admin', 'admin', 'rh'), turmasController.atualizar);

module.exports = router;
