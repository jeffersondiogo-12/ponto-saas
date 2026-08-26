require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { errorHandler } = require('./middlewares/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const empresasRoutes = require('./modules/empresas/empresas.routes');
const funcionariosRoutes = require('./modules/funcionarios/funcionarios.routes');
const dispositivosRoutes = require('./modules/dispositivos/dispositivos.routes');
const pontoRoutes = require('./modules/ponto/ponto.routes');
const relatoriosRoutes = require('./modules/relatorios/relatorios.routes');
const afdRoutes = require('./modules/afd/afd.routes');
const filiaisRoutes = require('./modules/filiais/filiais.routes');
const turmasRoutes = require('./modules/turmas/turmas.routes');
const alunosRoutes = require('./modules/alunos/alunos.routes');
const responsaveisRoutes = require('./modules/responsaveis/responsaveis.routes');
const professoresRoutes = require('./modules/professores/professores.routes');
const avisosRoutes = require('./modules/avisos/avisos.routes');
const auditoriaRoutes = require('./modules/auditoria/auditoria.routes');
const { processarPostPublico } = require('./modules/dispositivos/evoFacialServidor');

const app = express();
const tentativasEvoHttp = new Map();

/**
 * API pura - sem view engine, sem paginas server-rendered. O site (web/) e o
 * app (mobile/) sao clientes separados, consumindo isto so por HTTP/JSON.
 * Autenticacao e 100% Bearer token (sem cookie), porque um app mobile nao
 * tem "cookie do navegador" - o mesmo mecanismo de token serve os dois.
 */

const origensPermitidas = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  helmet({
    contentSecurityPolicy: false, // API pura, sem HTML proprio para proteger com CSP
  })
);
app.use(cors({ origin: origensPermitidas }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/pub/api', async (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const chave = typeof payload.sn === 'string' ? payload.sn.trim().toUpperCase() : req.ip;
    const agora = Date.now();
    const janela = tentativasEvoHttp.get(chave);
    if (!janela || agora - janela.inicio >= 60_000) {
      tentativasEvoHttp.set(chave, { inicio: agora, total: 1 });
    } else if (janela.total >= 30) {
      console.warn('[evo-facial:http] limite de requisicoes excedido:', chave);
      res.status(429).json({ ret: payload.cmd || null, result: false, reason: 'muitas requisicoes' });
      return;
    } else {
      janela.total += 1;
    }
    const resposta = await processarPostPublico(payload);
    console.log(
      '[evo-facial:http] POST /pub/api:',
      JSON.stringify({ cmd: payload.cmd || null, sn: payload.sn || null, resposta: resposta.ret || null })
    );
    res.status(200).json(resposta);
  } catch (err) {
    console.error('[evo-facial:http] erro processando /pub/api:', err.message);
    res.status(200).json({ ret: req.body?.cmd || null, result: false, reason: 'erro interno' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/dispositivos', dispositivosRoutes);
app.use('/api/ponto', pontoRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/afd', afdRoutes);
app.use('/api/filiais', filiaisRoutes);
app.use('/api/turmas', turmasRoutes);
app.use('/api/alunos', alunosRoutes);
app.use('/api/responsaveis', responsaveisRoutes);
app.use('/api/professores', professoresRoutes);
app.use('/api/avisos', avisosRoutes);
app.use('/api/auditoria', auditoriaRoutes);

app.get('/', (req, res) => res.json({ ok: true, servico: 'ponto-saas-api' }));

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota nao encontrada.' });
});

app.use(errorHandler);

module.exports = app;
