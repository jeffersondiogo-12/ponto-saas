const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { publicarEvento } = require('../../realtime');
const notificacoesService = require('../responsaveis/notificacoes.service');

function normalizarData(valor) {
  if (!valor) return new Date();
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw new AppError('Data de envio invalida.', 400);
  if (data.getTime() < Date.now() - 5000) throw new AppError('A data de envio nao pode estar no passado.', 400);
  return data;
}

async function validarAlvos(empresaId, alvos, filialId) {
  for (const alvo of alvos) {
    if (alvo.filial_id && alvo.turma_id) throw new AppError('Cada alvo deve informar filial ou turma, nao os dois.', 400);
    if (!alvo.filial_id && !alvo.turma_id) throw new AppError('Alvo invalido.', 400);
    if (alvo.filial_id) {
      if (filialId && alvo.filial_id !== filialId) throw new AppError('Alvo fora da filial do usuario.', 403);
      const filial = await db('filiais').where({ id: alvo.filial_id, empresa_id: empresaId }).first('id');
      if (!filial) throw new AppError('Filial nao encontrada nesta empresa.', 404);
    }
    if (alvo.turma_id) {
      const turma = await db('turmas').where({ id: alvo.turma_id, empresa_id: empresaId }).first('id', 'filial_id');
      if (!turma) throw new AppError('Turma nao encontrada nesta empresa.', 404);
      if (filialId && turma.filial_id !== filialId) throw new AppError('Turma fora da filial do usuario.', 403);
    }
  }
}

async function normalizarAlvos(empresaId, dados, filialId = null) {
  let alvos = Array.isArray(dados.alvos)
    ? dados.alvos.map((alvo) => ({ filial_id: alvo.filial_id || null, turma_id: alvo.turma_id || null }))
    : (dados.filial_id || dados.turma_id ? [{ filial_id: dados.filial_id || null, turma_id: dados.turma_id || null }] : []);
  const unicos = new Map(alvos.map((alvo) => [`${alvo.filial_id || ''}:${alvo.turma_id || ''}`, alvo]));
  alvos = [...unicos.values()];
  if (filialId && alvos.length === 0) alvos = [{ filial_id: filialId, turma_id: null }];
  await validarAlvos(empresaId, alvos, filialId);
  return alvos;
}

function filtroAlvo(query, aviso) {
  query.andWhere(function alvo() {
    this.where(function legado() {
      this.whereNotExists(db('aviso_alvos as aa').select(db.raw('1')).whereRaw('aa.aviso_id = ?', [aviso.id]));
      if (aviso.filial_id) this.where('a.filial_id', aviso.filial_id);
      if (aviso.turma_id) this.where('a.turma_id', aviso.turma_id);
    }).orWhereExists(db('aviso_alvos as aa').select(db.raw('1')).whereRaw('aa.aviso_id = ?', [aviso.id]).andWhere(function compatibilidade() {
      this.whereRaw('aa.filial_id = a.filial_id').orWhereRaw('aa.turma_id = a.turma_id');
    }));
  });
}

async function notificarAviso(empresaId, aviso) {
  const query = db('responsavel_alunos as ra').join('responsaveis as r', 'r.id', 'ra.responsavel_id').join('alunos as a', 'a.id', 'ra.aluno_id').join('push_tokens as pt', 'pt.responsavel_id', 'r.id').where({ 'r.empresa_id': empresaId, 'r.ativo': true, 'a.empresa_id': empresaId, 'a.ativo': true });
  filtroAlvo(query, aviso);
  const tokens = await query.distinct('pt.token');
  await Promise.all(tokens.map(({ token }) => notificacoesService.enviarPush({ to: token, title: aviso.titulo, body: aviso.mensagem, data: { tipo: 'aviso.lancado', avisoId: aviso.id } })));
}

async function destinatarios(empresaId, aviso) {
  const query = db('responsavel_alunos as ra').join('responsaveis as r', 'r.id', 'ra.responsavel_id').join('alunos as a', 'a.id', 'ra.aluno_id').where({ 'r.empresa_id': empresaId, 'r.ativo': true, 'a.empresa_id': empresaId, 'a.ativo': true });
  filtroAlvo(query, aviso);
  return query.distinct('r.id');
}

async function alvosDoAviso(id) {
  return db('aviso_alvos as aa').leftJoin('filiais as f', 'f.id', 'aa.filial_id').leftJoin('turmas as t', 't.id', 'aa.turma_id').where('aa.aviso_id', id).select('aa.filial_id', 'aa.turma_id', 'f.nome as filial_nome', 't.nome as turma_nome');
}

function status(aviso) {
  if (!aviso.ativo) return 'desativado';
  return aviso.enviado_em ? 'lancado' : 'aguardando_data';
}

async function enriquecer(aviso) {
  const [alvos, leituras, total] = await Promise.all([alvosDoAviso(aviso.id), db('aviso_leituras').where('aviso_id', aviso.id).countDistinct('responsavel_id as total').first(), destinatarios(aviso.empresa_id, aviso)]);
  return { ...aviso, status: status(aviso), alvos: alvos.length ? alvos : (aviso.filial_id || aviso.turma_id ? [{ filial_id: aviso.filial_id, turma_id: aviso.turma_id }] : []), total_leram: Number(leituras?.total || 0), total_destinatarios: total.length };
}

async function buscarBruto(empresaId, id, filialId = null) {
  const query = db('avisos_escola as a').select('a.*', 'f.nome as filial_nome', 't.nome as turma_nome').leftJoin('filiais as f', 'f.id', 'a.filial_id').leftJoin('turmas as t', 't.id', 'a.turma_id').where({ 'a.id': id, 'a.empresa_id': empresaId });
  if (filialId) query.where((scope) => scope.where('a.filial_id', filialId).orWhereNull('a.filial_id'));
  const aviso = await query.first();
  if (!aviso) throw new AppError('Aviso nao encontrado.', 404);
  return aviso;
}

async function criar(empresaId, dados, filialId = null) {
  const titulo = String(dados.titulo || '').trim();
  const mensagem = String(dados.mensagem || '').trim();
  if (!titulo) throw new AppError('Titulo e obrigatorio.', 400);
  if (!mensagem) throw new AppError('Mensagem e obrigatoria.', 400);
  const publicadoEm = normalizarData(dados.publicado_em);
  const alvos = await normalizarAlvos(empresaId, dados, filialId);
  const legado = alvos.length === 1 ? alvos[0] : { filial_id: null, turma_id: null };
  const imediato = publicadoEm.getTime() <= Date.now() + 5000;
  const aviso = await db.transaction(async (trx) => {
    const [criado] = await trx('avisos_escola').insert({ empresa_id: empresaId, filial_id: legado.filial_id, turma_id: legado.turma_id, titulo, mensagem, publicado_em: publicadoEm, enviado_em: imediato ? db.fn.now() : null }).returning('*');
    if (alvos.length > 1) await trx('aviso_alvos').insert(alvos.map((alvo) => ({ ...alvo, aviso_id: criado.id })));
    return criado;
  });
  if (imediato) await notificarAviso(empresaId, aviso);
  publicarEvento(imediato ? 'aviso.lancado' : 'aviso.criado', { empresaId, avisoId: aviso.id });
  return enriquecer(aviso);
}

async function listar(empresaId, filialId = null) {
  const query = db('avisos_escola as a').select('a.*', 'f.nome as filial_nome', 't.nome as turma_nome').leftJoin('filiais as f', 'f.id', 'a.filial_id').leftJoin('turmas as t', 't.id', 'a.turma_id').where('a.empresa_id', empresaId).orderBy('a.publicado_em', 'desc');
  if (filialId) query.where((scope) => scope.where('a.filial_id', filialId).orWhereNull('a.filial_id'));
  return Promise.all((await query).map(enriquecer));
}

async function buscar(empresaId, id, filialId = null) { return enriquecer(await buscarBruto(empresaId, id, filialId)); }

async function atualizar(empresaId, id, dados, filialId = null) {
  const atual = await buscarBruto(empresaId, id, filialId);
  if (atual.enviado_em) throw new AppError('Aviso ja enviado nao pode ser editado.', 409);
  const possuiAlvoNoCorpo = Array.isArray(dados.alvos) || dados.filial_id !== undefined || dados.turma_id !== undefined;
  const alvosAtuais = possuiAlvoNoCorpo ? [] : await alvosDoAviso(id);
  const alvos = alvosAtuais.length
    ? alvosAtuais.map((alvo) => ({ filial_id: alvo.filial_id, turma_id: alvo.turma_id }))
    : await normalizarAlvos(empresaId, dados, filialId);
  const legado = alvos.length === 1 ? alvos[0] : { filial_id: null, turma_id: null };
  const [aviso] = await db('avisos_escola').where({ id, empresa_id: empresaId }).update({ filial_id: legado.filial_id, turma_id: legado.turma_id, titulo: dados.titulo === undefined ? atual.titulo : String(dados.titulo || '').trim(), mensagem: dados.mensagem === undefined ? atual.mensagem : String(dados.mensagem || '').trim(), publicado_em: dados.publicado_em === undefined ? atual.publicado_em : normalizarData(dados.publicado_em) }).returning('*');
  await db('aviso_alvos').where('aviso_id', id).del();
  if (alvos.length > 1) await db('aviso_alvos').insert(alvos.map((alvo) => ({ ...alvo, aviso_id: id })));
  publicarEvento('aviso.atualizado', { empresaId, avisoId: id });
  return enriquecer(aviso);
}

async function remover(empresaId, id, filialId = null) {
  const aviso = await buscarBruto(empresaId, id, filialId);
  if (aviso.enviado_em && aviso.ativo) throw new AppError('Aviso ja enviado precisa ser desativado antes de ser excluido.', 409);
  await db('avisos_escola').where({ id, empresa_id: empresaId }).del();
  publicarEvento('aviso.removido', { empresaId, avisoId: id });
}

async function definirAtivo(empresaId, id, ativo, filialId = null) {
  const aviso = await buscarBruto(empresaId, id, filialId);
  const [atualizado] = await db('avisos_escola').where({ id: aviso.id, empresa_id: empresaId }).update({ ativo }).returning('*');
  publicarEvento(ativo ? 'aviso.ativado' : 'aviso.desativado', { empresaId, avisoId: id });
  return enriquecer(atualizado);
}

async function registrarLeitura(empresaId, avisoId, responsavelId, alunoIds) {
  const aviso = await buscarBruto(empresaId, avisoId);
  if (!aviso.ativo || !aviso.enviado_em) throw new AppError('Aviso nao encontrado.', 404);
  const query = db('alunos as a').whereIn('a.id', alunoIds).where('a.empresa_id', empresaId);
  filtroAlvo(query, aviso);
  if (!(await query.first('a.id'))) throw new AppError('Voce nao tem acesso a este aviso.', 403);
  const [leitura] = await db('aviso_leituras').insert({ aviso_id: avisoId, responsavel_id: responsavelId }).onConflict(['aviso_id', 'responsavel_id']).ignore().returning('*');
  return leitura || db('aviso_leituras').where({ aviso_id: avisoId, responsavel_id: responsavelId }).first();
}

async function processarPendentes() {
  const pendentes = await db('avisos_escola').where({ ativo: true }).whereNull('enviado_em').andWhere('publicado_em', '<=', db.fn.now());
  for (const aviso of pendentes) {
    try { await notificarAviso(aviso.empresa_id, aviso); } catch (err) { console.error('[avisos] falha no push agendado:', err.message); }
    await db('avisos_escola').where({ id: aviso.id }).whereNull('enviado_em').update({ enviado_em: db.fn.now() });
    publicarEvento('aviso.lancado', { empresaId: aviso.empresa_id, avisoId: aviso.id });
  }
  return pendentes.length;
}

async function duplicar(empresaId, id, dados, filialId = null) {
  const original = await buscar(empresaId, id, filialId);
  return criar(empresaId, { titulo: original.titulo, mensagem: original.mensagem, alvos: original.alvos, publicado_em: dados?.publicado_em }, filialId);
}

module.exports = { criar, listar, buscar, atualizar, remover, definirAtivo, registrarLeitura, processarPendentes, duplicar, notificarAviso };
