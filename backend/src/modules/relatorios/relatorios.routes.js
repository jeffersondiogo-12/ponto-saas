const express = require('express');
const db = require('../../config/db');
const { autenticar, exigirTipo } = require('../../middlewares/auth');
const { resolverTenant } = require('../../middlewares/tenant');

const router = express.Router();

router.use(autenticar, exigirTipo('staff'), resolverTenant);

/**
 * Espelho de ponto: um funcionario, um periodo, todos os apontamentos diarios.
 * E o relatorio classico que RH usa para conferencia mensal e para anexar
 * em caso de fiscalizacao/reclamatoria trabalhista.
 */
router.get('/espelho-ponto/:funcionarioId', async (req, res, next) => {
  try {
    const { de, ate } = req.query;
    const funcionario = await db('funcionarios')
      .where({ id: req.params.funcionarioId, empresa_id: req.empresaId })
      .first();
    if (!funcionario) return res.status(404).json({ erro: 'Funcionario nao encontrado.' });

    const query = db('apontamentos_diarios')
      .where({ empresa_id: req.empresaId, funcionario_id: req.params.funcionarioId })
      .orderBy('data', 'asc');
    if (de) query.where('data', '>=', de);
    if (ate) query.where('data', '<=', ate);

    const apontamentos = await query;

    const totais = apontamentos.reduce(
      (acc, a) => ({
        horas_trabalhadas_minutos: acc.horas_trabalhadas_minutos + a.horas_trabalhadas_minutos,
        horas_previstas_minutos: acc.horas_previstas_minutos + a.horas_previstas_minutos,
        saldo_minutos: acc.saldo_minutos + a.saldo_minutos,
        extras_50_minutos: acc.extras_50_minutos + a.extras_50_minutos,
        extras_100_minutos: acc.extras_100_minutos + a.extras_100_minutos,
        faltas: acc.faltas + (a.falta ? 1 : 0),
      }),
      {
        horas_trabalhadas_minutos: 0,
        horas_previstas_minutos: 0,
        saldo_minutos: 0,
        extras_50_minutos: 0,
        extras_100_minutos: 0,
        faltas: 0,
      }
    );

    res.json({ funcionario, apontamentos, totais });
  } catch (err) {
    next(err);
  }
});

/**
 * Resumo por empresa/periodo: quantas faltas, atrasos e horas extras no
 * agregado - visao rapida para o gestor sem abrir funcionario por funcionario.
 */
router.get('/resumo-periodo', async (req, res, next) => {
  try {
    const { de, ate } = req.query;
    const query = db('apontamentos_diarios as a')
      .select(
        'f.id as funcionario_id',
        'f.nome',
        'f.matricula',
        db.raw('SUM(a.horas_trabalhadas_minutos) as horas_trabalhadas_minutos'),
        db.raw('SUM(a.saldo_minutos) as saldo_minutos'),
        db.raw('SUM(a.extras_50_minutos + a.extras_100_minutos) as extras_minutos'),
        db.raw('SUM(CASE WHEN a.falta THEN 1 ELSE 0 END) as faltas'),
        db.raw('SUM(a.atraso_minutos) as atraso_minutos')
      )
      .join('funcionarios as f', 'f.id', 'a.funcionario_id')
      .where('a.empresa_id', req.empresaId)
      .groupBy('f.id', 'f.nome', 'f.matricula')
      .orderBy('f.nome');

    if (de) query.where('a.data', '>=', de);
    if (ate) query.where('a.data', '<=', ate);

    const resumo = await query;
    res.json({ resumo });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
