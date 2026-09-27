// Confere a logica da cara do app (fila, cache, card do filho e chave VAPID). Sem framework:
//   node web/scripts/checar-app.mjs
// Termina com "ok" ou para no primeiro assert que falhar.
import assert from 'node:assert/strict';

// localStorage de mentira. O Proxy faz `Object.keys(localStorage)` listar as
// chaves guardadas, como no navegador — o `limparCache` depende disso.
const guardado = new Map();
globalThis.localStorage = new Proxy({
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
  removeItem: (k) => guardado.delete(k),
}, {
  ownKeys: () => [...guardado.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

const fila = await import('../src/app/filaOffline.js');
const cache = await import('../src/app/cacheOffline.js');

// Filas separadas por conta.
fila.enfileirar('professor:a', { rotulo: 'Chamada', caminho: '/a', method: 'POST' });
fila.enfileirar('responsavel:b', { rotulo: 'Leitura', caminho: '/b', method: 'POST' });
assert.deepEqual(fila.obterFila('professor:a').map((i) => i.caminho), ['/a']);
assert.equal(fila.obterFila('professor:a')[0].namespace, 'professor:a');

// Ordem de inclusao preservada.
fila.enfileirar('professor:a', { rotulo: 'Nota', caminho: '/a2' });
fila.enfileirar('professor:a', { rotulo: 'Observação', caminho: '/a3' });
assert.deepEqual(fila.obterFila('professor:a').map((i) => i.rotulo), ['Chamada', 'Nota', 'Observação']);

// Ouvinte so da conta que mudou, e para de ouvir quando pede.
let avisosA = 0;
let avisosB = 0;
const pararA = fila.ouvirFila('professor:a', () => { avisosA += 1; });
fila.ouvirFila('responsavel:b', () => { avisosB += 1; });
fila.enfileirar('professor:a', { rotulo: 'x', caminho: '/x' });
assert.equal(avisosA, 1);
assert.equal(avisosB, 0);
pararA();
fila.enfileirar('professor:a', { rotulo: 'y', caminho: '/y' });
assert.equal(avisosA, 1);

// Recusa marca o item; reabrir desfaz; remover tira so ele.
const [primeiro] = fila.obterFila('professor:a');
fila.marcarFalhaNaFila('professor:a', primeiro.id, 'Turma inexistente');
assert.equal(fila.obterFila('professor:a')[0].falhaDefinitiva, true);
assert.equal(fila.obterFila('professor:a')[0].erro, 'Turma inexistente');
fila.reabrirNaFila('professor:a', primeiro.id);
assert.equal(fila.obterFila('professor:a')[0].falhaDefinitiva, false);
fila.removerDaFila('professor:a', primeiro.id);
assert.equal(fila.obterFila('professor:a')[0].rotulo, 'Nota');

// Limpar uma conta nao toca na outra; sem conta, nao guarda nada.
fila.limparFila('professor:a');
assert.equal(fila.obterFila('professor:a').length, 0);
assert.equal(fila.obterFila('responsavel:b').length, 1);
assert.deepEqual(fila.obterFila(null), []);
assert.throws(() => fila.enfileirar(null, { caminho: '/z' }));

// Cache: devolve o salvo, vence em 7 dias, limpa por conta.
cache.salvarCache('professor:a', '/turmas', { turmas: [1] });
cache.salvarCache('responsavel:b', '/turmas', { turmas: [2] });
assert.deepEqual(cache.lerCache('professor:a', '/turmas').dados, { turmas: [1] });
const agora = Date.now;
Date.now = () => agora() + 8 * 24 * 60 * 60 * 1000;
assert.equal(cache.lerCache('professor:a', '/turmas'), null);
Date.now = agora;
cache.limparCache('responsavel:b');
assert.equal(cache.lerCache('responsavel:b', '/turmas'), null);

// Card do filho: avisos pendentes, o que e "novo" e a ultima passagem.
const novidades = await import('../src/app/novidades.js');
novidades.marcarAvisoLido('responsavel:b', 'aviso-1');
assert.equal(novidades.avisosLidos('responsavel:b').has('aviso-1'), true);
assert.equal(novidades.avisosLidos('responsavel:outro').has('aviso-1'), false);

const avisos = [{ id: 'aviso-1' }, { id: 'aviso-2' }, { id: 'aviso-3', lido_em: '2026-09-27T10:00:00Z' }];
const notas = [{ created_at: '2026-09-27T12:00:00Z' }];
const registros = [{ tipoExibicao: 'Saída', data_hora: '2026-09-27T17:00:00Z' }, { tipoExibicao: 'Chegada' }];
const lidos = novidades.avisosLidos('responsavel:b');

// Sem visita registrada, nada conta como novo; o lido_em da API tambem vale.
let resumo = novidades.resumoDoFilho({ registros, avisos, notas, observacoes: [], lidos, vistaEm: null });
assert.equal(resumo.avisosPendentes, 1);
assert.equal(resumo.notaNova, false);
assert.equal(resumo.ultima.tipoExibicao, 'Saída');

// Nota lancada depois da ultima visita a ficha e nova; antes, nao.
resumo = novidades.resumoDoFilho({ notas, lidos, vistaEm: Date.parse('2026-09-27T11:00:00Z') });
assert.equal(resumo.notaNova, true);
resumo = novidades.resumoDoFilho({ notas, lidos, vistaEm: Date.parse('2026-09-27T13:00:00Z') });
assert.equal(resumo.notaNova, false);
assert.equal(resumo.ultima, null);

assert.equal(novidades.rotuloDaPassagem({ tipoExibicao: 'Chegada' }), 'Chegada registrada');
assert.equal(novidades.rotuloDaPassagem({ tipoExibicao: 'Registro' }), 'Passagem registrada');

// Chave VAPID: a inscricao presa a outra chave precisa ser refeita.
const vapid = await import('../src/app/chaveVapid.js');
const chaveA = 'BAjJUwtAB4MkUF4z0zbBswevw2vwicLBCC7StYJFwGDgNe8G4RUw0Cbj7ujpbPn1xoFZ0nujeyer_bTsjlFa6J8';
const chaveB = 'BLc4xRzKlKORKWlbdgFaBrrPK3ydWAHo4M0gs0i1oEKgPpWC5cW8OCzVrOQRv-1npXRWk8udnW3oYhIO4475rds';
assert.equal(vapid.bytesDaChave(chaveA).length, 65);
const inscricaoA = { options: { applicationServerKey: vapid.bytesDaChave(chaveA).buffer } };
assert.equal(vapid.inscritaComChave(inscricaoA, chaveA), true);
assert.equal(vapid.inscritaComChave(inscricaoA, chaveB), false);
assert.equal(vapid.inscritaComChave({}, chaveB), true); // navegador que nao informa: nao refaz

console.log('ok');
