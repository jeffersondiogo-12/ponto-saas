import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api, obterUltimaSincronizacao } from '../api';
import { obterFila, ouvirFila, removerDaFila, reabrirNaFila } from '../filaOffline';
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

  const carregar = useCallback(async () => {
    const [itens, data] = await Promise.all([obterFila(), obterUltimaSincronizacao()]);
    setFila(itens);
    setUltima(data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    return ouvirFila(setFila);
  }, [carregar]);

  async function sincronizar() {
    setProcessando(true);
    await api.processarFilaOffline();
    await carregar();
    setProcessando(false);
  }

  function excluir(item) {
    Alert.alert('Remover ação', `Excluir "${item.rotulo}" da fila?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removerDaFila(item.id) },
    ]);
  }

  async function tentarNovamente(item) {
    await reabrirNaFila(item.id);
    await sincronizar();
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
