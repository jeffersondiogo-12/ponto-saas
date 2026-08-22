const express = require('express');
const empresasController = require('./empresas.controller');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'));

// Listar/criar empresas e operacao de plataforma (apenas super_admin).
router.get('/', exigirPapel('super_admin'), empresasController.listar);
router.post('/', exigirPapel('super_admin'), empresasController.criar);

// Ver/editar a propria empresa e permitido para admin/rh tambem.
router.get('/:id', empresasController.buscar);
router.put('/:id', exigirPapel('super_admin', 'admin'), empresasController.atualizar);
router.delete('/:id', exigirPapel('super_admin'), empresasController.excluir);

module.exports = router;
