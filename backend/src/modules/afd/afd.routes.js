const express = require('express');
const afdService = require('./afd.service');
const { autenticar, exigirPapel, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');
const { exigirPermissao } = require('../../middlewares/permissions');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant, exigirPermissao('afd', 'ver'));

router.get('/', async (req, res, next) => {
  try {
    const exportacoes = await afdService.listarExportacoes(req.empresaId);
    res.json({ exportacoes });
  } catch (err) {
    next(err);
  }
});

router.post('/gerar', async (req, res, next) => {
  try {
    const { periodo_inicio, periodo_fim } = req.body;
    const resultado = await afdService.gerarAFD(req.empresaId, {
      periodoInicio: periodo_inicio,
      periodoFim: periodo_fim,
      geradoPorUsuarioId: req.usuario.id,
    });
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const exportacao = await require('../../config/db')('afd_exports')
      .where({ id: req.params.id, empresa_id: req.empresaId })
      .first();
    if (!exportacao) return res.status(404).json({ erro: 'Exportacao nao encontrada.' });
    res.download(exportacao.arquivo_path);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
