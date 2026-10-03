jest.mock('@react-native-async-storage/async-storage');

const React = require('react');
const { act, create } = require('react-test-renderer');
const { DeviceEventEmitter } = require('react-native');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const novidades = require('../src/novidades');
const { useRecarregarAoVivo } = require('../src/realtime');

// Regra do card do filho na Home do responsavel (#56) e da leitura de aviso
// (#57). Mesmos casos do web/scripts/checar-app.mjs, que confere o PWA.
describe('card do filho', () => {
  beforeEach(() => AsyncStorage.__reset());

  test('"lido" fica por conta e nao vaza para outra', async () => {
    await novidades.marcarAvisoLido('responsavel:b', 'aviso-1');
    expect((await novidades.avisosLidos('responsavel:b')).has('aviso-1')).toBe(true);
    expect((await novidades.avisosLidos('responsavel:outro')).has('aviso-1')).toBe(false);
    expect((await novidades.avisosLidos(null)).size).toBe(0);
  });

  test('o lido_em da API tambem vale como lido', async () => {
    const lidos = new Set(['aviso-1']);
    expect(novidades.ehLido({ id: 'aviso-1' }, lidos)).toBe(true);
    expect(novidades.ehLido({ id: 'aviso-2' }, lidos)).toBe(false);
    expect(novidades.ehLido({ id: 'aviso-3', lido_em: '2026-09-27T10:00:00Z' }, lidos)).toBe(true);
  });

  test('aviso da escola que chega aos dois filhos conta uma vez', () => {
    const daEscola = { id: 'escola-1' };
    const total = novidades.contarAvisosNaoLidos([[daEscola, { id: 'turma-a' }], [daEscola]], new Set());
    expect(total).toBe(2);
    expect(novidades.contarAvisosNaoLidos([[daEscola]], new Set(['escola-1']))).toBe(0);
  });

  test('sem visita registrada, nada conta como novo', () => {
    const resumo = novidades.resumoDoFilho({
      registros: [{ tipoExibicao: 'Saída' }, { tipoExibicao: 'Chegada' }],
      avisos: [{ id: 'aviso-1' }, { id: 'aviso-2' }],
      notas: [{ created_at: '2026-09-27T12:00:00Z' }],
      lidos: new Set(['aviso-1']),
      vistaEm: null,
    });
    expect(resumo.ultima.tipoExibicao).toBe('Saída');
    expect(resumo.avisosPendentes).toBe(1);
    expect(resumo.notaNova).toBe(false);
  });

  test('nota e observacao lancadas depois da ultima visita sao novas; antes, nao', () => {
    const notas = [{ created_at: '2026-09-27T12:00:00Z' }];
    const observacoes = [{ created_at: '2026-09-27T12:30:00Z' }];
    const lidos = new Set();
    let resumo = novidades.resumoDoFilho({ notas, observacoes, lidos, vistaEm: Date.parse('2026-09-27T11:00:00Z') });
    expect(resumo).toMatchObject({ notaNova: true, observacaoNova: true, ultima: null });
    resumo = novidades.resumoDoFilho({ notas, observacoes, lidos, vistaEm: Date.parse('2026-09-27T12:15:00Z') });
    expect(resumo).toMatchObject({ notaNova: false, observacaoNova: true });
  });

  test('rotulo da passagem', () => {
    expect(novidades.rotuloDaPassagem({ tipoExibicao: 'Chegada' })).toBe('Chegada registrada');
    expect(novidades.rotuloDaPassagem({ tipoExibicao: 'Saída' })).toBe('Saída registrada');
    expect(novidades.rotuloDaPassagem({ tipoExibicao: 'Registro' })).toBe('Passagem registrada');
  });

  test('visita a ficha por conta e por filho', async () => {
    await novidades.marcarFichaVista('responsavel:b', 'aluno-1', 1000);
    await expect(novidades.fichaVistaEm('responsavel:b', 'aluno-1')).resolves.toBe(1000);
    await expect(novidades.fichaVistaEm('responsavel:b', 'aluno-2')).resolves.toBeNull();
    await expect(novidades.fichaVistaEm(null, 'aluno-1')).resolves.toBeNull();
  });

  test('aparelho sem espaco nao derruba a tela', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('cheio')).mockRejectedValueOnce(new Error('cheio'));
    await expect(novidades.marcarFichaVista('responsavel:b', 'aluno-1')).resolves.toBeUndefined();
    await expect(novidades.marcarAvisoLido('responsavel:b', 'aviso-1')).resolves.toBeUndefined();
  });
});

describe('recarga ao vivo', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function montar(recarregar, aceitar) {
    function Tela() {
      useRecarregarAoVivo(['ponto.criado', 'aviso.lancado'], recarregar, aceitar);
      return null;
    }
    let tela;
    act(() => { tela = create(React.createElement(Tela)); });
    return tela;
  }

  const emitir = (tipo, dados = {}) => act(() => { DeviceEventEmitter.emit('ponto-saas:atualizado', { tipo, dados }); });

  test('rajada vira uma recarga so, 1,5 s depois do ultimo evento', () => {
    const recarregar = jest.fn();
    const tela = montar(recarregar);
    emitir('ponto.criado');
    act(() => { jest.advanceTimersByTime(1000); });
    emitir('ponto.criado');
    act(() => { jest.advanceTimersByTime(1499); });
    expect(recarregar).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(recarregar).toHaveBeenCalledTimes(1);
    act(() => { tela.unmount(); });
  });

  test('ignora tipo fora da lista e aluno que nao e da familia', () => {
    const recarregar = jest.fn();
    const tela = montar(recarregar, (mensagem) => !mensagem.dados.alunoId || mensagem.dados.alunoId === 'meu-filho');
    emitir('nota.criada', { alunoId: 'meu-filho' });
    emitir('ponto.criado', { alunoId: 'outra-crianca' });
    act(() => { jest.advanceTimersByTime(2000); });
    expect(recarregar).not.toHaveBeenCalled();

    emitir('ponto.criado', { alunoId: 'meu-filho' });
    act(() => { jest.advanceTimersByTime(1500); });
    emitir('aviso.lancado', { avisoId: 'a1' });
    act(() => { jest.advanceTimersByTime(1500); });
    expect(recarregar).toHaveBeenCalledTimes(2);
    act(() => { tela.unmount(); });
  });

  test('sair da tela cancela a recarga pendente', () => {
    const recarregar = jest.fn();
    const tela = montar(recarregar);
    emitir('ponto.criado');
    act(() => { tela.unmount(); });
    act(() => { jest.advanceTimersByTime(2000); });
    expect(recarregar).not.toHaveBeenCalled();
  });
});
