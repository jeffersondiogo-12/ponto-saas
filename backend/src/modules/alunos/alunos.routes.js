const express = require('express');
const alunosController = require('./alunos.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', alunosController.listar);
router.get('/:id', alunosController.buscar);
router.get('/:id/frequencia', alunosController.frequencia);
router.post('/', exigirPapel('super_admin', 'admin', 'rh'), alunosController.criar);
router.put('/:id', exigirPapel('super_admin', 'admin', 'rh'), alunosController.atualizar);
router.delete('/:id', exigirPapel('super_admin', 'admin', 'rh'), alunosController.excluir);
router.post('/:id/dispositivos', exigirPapel('super_admin', 'admin', 'rh'), alunosController.vincularDispositivo);

module.exports = router;
