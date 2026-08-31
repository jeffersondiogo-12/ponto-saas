import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { AparecerEm, Pulsar } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

export default function RelatoriosScreen() {
  const [linhas, setLinhas] = useState([]);
  const [offline, setOffline] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const resposta = await api.resumoProfessor();
      setLinhas(resposta.resumo || []);
      setOffline(Boolean(resposta._offline));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <View style={estilos.container}>
      <View style={estilos.topo}>
        <Text style={estilos.rotulo}>VISÃO RÁPIDA</Text>
        <Text style={estilos.titulo}>Resumo das turmas</Text>
        <Text style={estilos.subtitulo}>Alunos, presença facial e aulas atribuídas.</Text>
      </View>
      {offline && <Pulsar style={estilos.offline}><Text style={estilos.offlineTexto}>Sem conexão — mostrando o último resumo salvo.</Text></Pulsar>}
      {carregando ? <ActivityIndicator color={cores.azul} style={estilos.carregando} /> : (
        <FlatList
          data={linhas}
          keyExtractor={(item) => item.atribuicao_id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={carregar} tintColor={cores.azul} />}
          contentContainerStyle={linhas.length ? estilos.lista : estilos.listaVazia}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma turma atribuída.</Text>}
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 55}>
              <View style={estilos.card}>
                <View style={estilos.cardTopo}>
                  <View style={estilos.textos}>
                    <Text style={estilos.turma}>{item.turma_nome}</Text>
                    <Text style={estilos.materia}>{item.materia} · {item.horario}</Text>
                  </View>
                  <Text style={estilos.total}>{item.total_alunos}</Text>
                </View>
                <View style={estilos.linha}>
                  <Text style={estilos.rotuloDado}>Alunos</Text><Text style={estilos.valorDado}>{item.total_alunos}</Text>
                </View>
                <View style={estilos.linha}>
                  <Text style={estilos.rotuloDado}>Com batida facial hoje</Text><Text style={estilos.valorDado}>{item.presentes_facial}</Text>
                </View>
                <View style={estilos.linha}>
                  <Text style={estilos.rotuloDado}>Sem batida facial</Text><Text style={estilos.valorDado}>{item.total_alunos - item.presentes_facial}</Text>
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
  subtitulo: { color: cores.claroSuave, fontSize: 13, marginTop: 6 },
  offline: { margin: 18, marginBottom: 0, backgroundColor: cores.surface, borderLeftWidth: 3, borderLeftColor: cores.inkSoft, borderRadius: raio.sm, padding: 12 },
  offlineTexto: { color: cores.inkSoft, fontSize: 12.5 },
  carregando: { marginTop: 30 },
  lista: { padding: 18, paddingBottom: 30 },
  listaVazia: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  vazio: { color: cores.inkSoft },
  card: { backgroundColor: cores.surface, borderRadius: raio.md, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: cores.linha, ...sombra.cartao },
  cardTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: cores.linha },
  textos: { flex: 1 },
  turma: { color: cores.ink, fontSize: 15, fontWeight: '800' },
  materia: { color: cores.azul, fontSize: 12.5, fontWeight: '700', marginTop: 4 },
  total: { color: cores.verdeEscuro, backgroundColor: cores.verdeSoft, borderRadius: raio.pill, paddingHorizontal: 10, paddingVertical: 6, fontWeight: '800' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  rotuloDado: { color: cores.inkSoft, fontSize: 12.5 },
  valorDado: { color: cores.ink, fontSize: 12.5, fontWeight: '800' },
});
