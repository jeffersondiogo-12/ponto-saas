const express = require('express');
const turmasController = require('./turmas.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', turmasController.listar);
router.get('/:id', turmasController.buscar);
router.get('/:id/horarios', exigirPapel('super_admin', 'admin', 'gestor'), turmasController.listarHorarios);
router.put('/:id/horarios', exigirPapel('super_admin', 'admin', 'gestor'), turmasController.salvarHorario);
router.delete('/:id/horarios/:horarioId', exigirPapel('super_admin', 'admin', 'gestor'), turmasController.removerHorario);
router.post('/', exigirPapel('super_admin', 'admin', 'rh'), turmasController.criar);
router.put('/:id', exigirPapel('super_admin', 'admin', 'rh'), turmasController.atualizar);
router.delete('/:id', exigirPapel('super_admin', 'admin', 'rh'), turmasController.excluir);

module.exports = router;
