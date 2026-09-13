import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { obterNamespaceCache, obterUltimaSincronizacao, processarFilaOffline } from '../api';
import { obterFila, ouvirFila, removerDaFila, reabrirNaFila, obterFilaLegada, limparFilaLegada } from '../filaOffline';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

function formatarData(iso) {
  if (!iso) return 'Ainda não sincronizado';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function SincronizacaoScreen() {
  const [fila, setFila] = useState([]);
  const [ultima, setUltima] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [namespace, setNamespace] = useState(null);
  const [filaLegada, setFilaLegada] = useState([]);

  const carregar = useCallback(async () => {
    const namespaceAtual = await obterNamespaceCache();
    const [itens, legada, data] = await Promise.all([
      namespaceAtual ? obterFila(namespaceAtual) : Promise.resolve([]),
      obterFilaLegada(),
      obterUltimaSincronizacao(),
    ]);
    setNamespace(namespaceAtual);
    setFila(itens);
    setFilaLegada(legada);
    setUltima(data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    carregar();
    let parar = () => {};
    obterNamespaceCache().then((namespaceAtual) => {
      if (ativo && namespaceAtual) parar = ouvirFila(namespaceAtual, setFila);
    });
    return () => {
      ativo = false;
      parar();
    };
  }, [carregar]);

  async function sincronizar() {
    setProcessando(true);
    try {
      await processarFilaOffline();
      await carregar();
    } finally {
      setProcessando(false);
    }
  }

  function excluir(item) {
    Alert.alert('Remover ação', `Excluir "${item.rotulo}" da fila?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => namespace && removerDaFila(namespace, item.id) },
    ]);
  }

  async function tentarNovamente(item) {
    if (!namespace) return;
    await reabrirNaFila(namespace, item.id);
    await sincronizar();
  }

  function descartarFilaLegada() {
    Alert.alert(
      'Descartar ações antigas',
      'Estas ações foram criadas antes do isolamento por conta e não podem ser sincronizadas automaticamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            await limparFilaLegada();
            setFilaLegada([]);
          },
        },
      ],
    );
  }

  return (
    <View style={estilos.container}>
      <View style={estilos.topo}>
        <Text style={estilos.rotulo}>CONEXÃO E DADOS</Text>
        <Text style={estilos.titulo}>Sincronização</Text>
        <Text style={estilos.subtitulo}>Acompanhe ações que aguardam internet ou precisam de revisão.</Text>
      </View>
      <View style={estilos.resumo}>
        <Text style={estilos.resumoTitulo}>Última sincronização</Text>
        <Text style={estilos.resumoValor}>{formatarData(ultima)}</Text>
        <Text style={estilos.resumoDetalhe}>{fila.length ? `${fila.length} ação(ões) na fila` : 'Tudo sincronizado'}</Text>
      </View>
      {filaLegada.length ? (
        <View style={estilos.legada}>
          <Text style={estilos.legadaTexto}>
            {filaLegada.length} ação(ões) antigas foram bloqueadas porque não possuem uma conta de origem segura.
          </Text>
          <PressaoAnimada onPress={descartarFilaLegada}>
            <Text style={estilos.legadaAcao}>Revisar e descartar</Text>
          </PressaoAnimada>
        </View>
      ) : null}
      <PressaoAnimada style={estilos.botao} onPress={sincronizar} disabled={processando}>
        {processando ? <ActivityIndicator color={cores.claro} /> : <Text style={estilos.botaoTexto}>Sincronizar agora</Text>}
      </PressaoAnimada>
      {carregando ? <ActivityIndicator color={cores.azul} style={estilos.carregando} /> : (
        <FlatList
          data={fila}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={processando} onRefresh={sincronizar} tintColor={cores.azul} />}
          contentContainerStyle={fila.length ? estilos.lista : estilos.listaVazia}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma ação pendente.</Text>}
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 45}>
              <View style={estilos.item}>
                <View style={estilos.itemTexto}>
                  <Text style={estilos.itemTitulo}>{item.rotulo}</Text>
                  <Text style={estilos.itemData}>Criada em {formatarData(item.criadoEm)}</Text>
                  {item.falhaDefinitiva ? <Text style={estilos.falha}>Falha: {item.erro}</Text> : <Text style={estilos.pendente}>Aguardando conexão</Text>}
                </View>
                <View style={estilos.acoes}>
                  {item.falhaDefinitiva && <PressaoAnimada style={estilos.botaoPequeno} onPress={() => tentarNovamente(item)}><Text style={estilos.botaoPequenoTexto}>Tentar</Text></PressaoAnimada>}
                  <PressaoAnimada style={estilos.botaoRemover} onPress={() => excluir(item)}><Text style={estilos.botaoRemoverTexto}>Remover</Text></PressaoAnimada>
                </View>
              </View>
            </AparecerEm>
          )}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.paper },
  topo: { backgroundColor: cores.ink, paddingTop: 58, paddingHorizontal: 20, paddingBottom: 22 },
  rotulo: { color: cores.claroSuave, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  titulo: { color: cores.claro, fontSize: 25, fontWeight: '800', marginTop: 5 },
  subtitulo: { color: cores.claroSuave, fontSize: 13, lineHeight: 19, marginTop: 6 },
  resumo: { margin: 18, padding: 16, backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: cores.linha, ...sombra.cartao },
  resumoTitulo: { color: cores.inkSoft, fontSize: 12, fontWeight: '700' },
  resumoValor: { color: cores.ink, fontSize: 17, fontWeight: '800', marginTop: 5 },
  resumoDetalhe: { color: cores.azul, fontSize: 12.5, marginTop: 6, fontWeight: '700' },
  legada: { marginHorizontal: 18, marginBottom: 14, padding: 12, backgroundColor: cores.vermelhoSoft, borderLeftWidth: 3, borderLeftColor: cores.vermelho, borderRadius: raio.sm },
  legadaTexto: { color: cores.vermelho, fontSize: 12, lineHeight: 17 },
  legadaAcao: { color: cores.vermelho, fontSize: 12, fontWeight: '800', marginTop: 8 },
  botao: { marginHorizontal: 18, backgroundColor: cores.azul, borderRadius: raio.sm, padding: 15, alignItems: 'center', ...sombra.destaque },
  botaoTexto: { color: cores.claro, fontWeight: '800' },
  carregando: { marginTop: 30 },
  lista: { padding: 18, paddingBottom: 30 },
  listaVazia: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  vazio: { color: cores.inkSoft, textAlign: 'center' },
  item: { backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: cores.linha, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 10 },
  itemTexto: { flex: 1 },
  itemTitulo: { color: cores.ink, fontSize: 14, fontWeight: '800' },
  itemData: { color: cores.inkSoft, fontSize: 11.5, marginTop: 5 },
  pendente: { color: cores.azul, fontSize: 12, fontWeight: '700', marginTop: 5 },
  falha: { color: cores.vermelho, fontSize: 12, lineHeight: 17, marginTop: 5 },
  acoes: { alignItems: 'flex-end', justifyContent: 'center', gap: 7 },
  botaoPequeno: { backgroundColor: cores.azulSoft, borderRadius: raio.sm, paddingHorizontal: 10, paddingVertical: 7 },
  botaoPequenoTexto: { color: cores.azul, fontWeight: '800', fontSize: 11.5 },
  botaoRemover: { paddingHorizontal: 6, paddingVertical: 5 },
  botaoRemoverTexto: { color: cores.vermelho, fontWeight: '700', fontSize: 11.5 },
});
