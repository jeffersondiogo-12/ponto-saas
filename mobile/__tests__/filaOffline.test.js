jest.mock('@react-native-async-storage/async-storage');

const AsyncStorage = require('@react-native-async-storage/async-storage');
const fila = require('../src/filaOffline');

describe('fila offline namespaceada', () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    jest.restoreAllMocks();
  });

  test('mantém filas independentes por conta', async () => {
    const contaA = 'responsavel:a:empresa:global';
    const contaB = 'professor:b:empresa:filial';

    await fila.enfileirar(contaA, { rotulo: 'Ação A', caminho: '/a' });
    await fila.enfileirar(contaB, { rotulo: 'Ação B', caminho: '/b' });

    await expect(fila.obterFila(contaA)).resolves.toHaveLength(1);
    await expect(fila.obterFila(contaA)).resolves.toMatchObject([{ namespace: contaA, caminho: '/a' }]);
    await expect(fila.obterFila(contaB)).resolves.toMatchObject([{ namespace: contaB, caminho: '/b' }]);
  });

  test('notifica somente listeners do namespace alterado', async () => {
    const contaA = 'a';
    const contaB = 'b';
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    fila.ouvirFila(contaA, listenerA);
    fila.ouvirFila(contaB, listenerB);

    await fila.enfileirar(contaA, { rotulo: 'Ação A', caminho: '/a' });

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();
  });

  test('preserva a ordem de inclusões concorrentes', async () => {
    const namespace = 'professor:ordem:empresa:filial';
    await Promise.all([
      fila.enfileirar(namespace, { rotulo: 'primeira', caminho: '/1' }),
      fila.enfileirar(namespace, { rotulo: 'segunda', caminho: '/2' }),
      fila.enfileirar(namespace, { rotulo: 'terceira', caminho: '/3' }),
    ]);

    await expect(fila.obterFila(namespace)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rotulo: 'primeira' }),
        expect.objectContaining({ rotulo: 'segunda' }),
        expect.objectContaining({ rotulo: 'terceira' }),
      ]),
    );
    const itens = await fila.obterFila(namespace);
    expect(itens.map((item) => item.rotulo)).toEqual(['primeira', 'segunda', 'terceira']);
  });

  test('não atribui fila legada a uma conta', async () => {
    const legado = [{ id: 'legado-1', caminho: '/antiga' }];
    AsyncStorage.__set('@ponto_saas_fila_offline', JSON.stringify(legado));

    await expect(fila.obterFila('responsavel:nova:empresa:global')).resolves.toEqual([]);
    await expect(fila.obterFilaLegada()).resolves.toEqual(legado);
    expect(AsyncStorage.__get('@ponto_saas_fila_offline:bloqueada')).toBe('1');
    expect(AsyncStorage.__get('@ponto_saas_fila_offline:v2:migrada')).toBe('1');
  });
});
