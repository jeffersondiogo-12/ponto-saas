const express = require('express');
const turmasController = require('./turmas.controller');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { exigirPermissao } = require('../../middlewares/permissions');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

router.get('/', exigirPermissao('turmas', 'ver'), turmasController.listar);
router.get('/:id', exigirPermissao('turmas', 'ver'), turmasController.buscar);
router.get('/:id/horarios', exigirPermissao('turmas', 'ver'), turmasController.listarHorarios);
router.put('/:id/horarios', exigirPermissao('turmas', 'atualizar'), turmasController.salvarHorario);
router.delete('/:id/horarios/:horarioId', exigirPermissao('turmas', 'deletar'), turmasController.removerHorario);
router.post('/', exigirPermissao('turmas', 'adicionar'), turmasController.criar);
router.put('/:id', exigirPermissao('turmas', 'atualizar'), turmasController.atualizar);
router.delete('/:id', exigirPermissao('turmas', 'deletar'), turmasController.excluir);

module.exports = router;
