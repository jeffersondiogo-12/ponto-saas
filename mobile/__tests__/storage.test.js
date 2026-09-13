jest.mock('@react-native-async-storage/async-storage');

const AsyncStorage = require('@react-native-async-storage/async-storage');
const storage = require('../src/storage');

describe('cache namespaceado', () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    jest.restoreAllMocks();
  });

  test('não compartilha dados entre contas', async () => {
    await storage.salvarCache('responsavel:conta-a:empresa-a:global', '/api/alunos', { alunos: ['A'] });
    await storage.salvarCache('responsavel:conta-b:empresa-a:global', '/api/alunos', { alunos: ['B'] });

    await expect(storage.lerCache('responsavel:conta-a:empresa-a:global', '/api/alunos'))
      .resolves.toMatchObject({ dados: { alunos: ['A'] } });
    await expect(storage.lerCache('responsavel:conta-b:empresa-a:global', '/api/alunos'))
      .resolves.toMatchObject({ dados: { alunos: ['B'] } });
  });

  test('descarta cache expirado', async () => {
    const agora = Date.now();
    jest.spyOn(Date, 'now').mockReturnValueOnce(agora).mockReturnValue(agora + (7 * 24 * 60 * 60 * 1000) + 1);

    await storage.salvarCache('professor:conta-a:empresa-a:filial-a', '/api/turmas', { turmas: [] });
    await expect(storage.lerCache('professor:conta-a:empresa-a:filial-a', '/api/turmas')).resolves.toBeNull();
  });

  test('remove somente o namespace solicitado', async () => {
    await storage.salvarCache('a', '/recurso', { valor: 'A' });
    await storage.salvarCache('b', '/recurso', { valor: 'B' });

    await storage.limparCacheNamespace('a');

    await expect(storage.lerCache('a', '/recurso')).resolves.toBeNull();
    await expect(storage.lerCache('b', '/recurso')).resolves.toMatchObject({ dados: { valor: 'B' } });
  });
});
