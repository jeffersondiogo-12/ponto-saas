import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { AparecerEm, Pulsar } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

const DIAS = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
const FUSO_BRASILIA = 'America/Sao_Paulo';

function ordenarTurmas(turmas) {
  return [...turmas].sort((a, b) => {
    const diaA = (Array.isArray(a.dias_semana) ? a.dias_semana : []).sort()[0] ?? 7;
    const diaB = (Array.isArray(b.dias_semana) ? b.dias_semana : []).sort()[0] ?? 7;
    return diaA - diaB || String(a.hora_inicio).localeCompare(String(b.hora_inicio));
  });
}

export default function AgendaScreen() {
  const [turmas, setTurmas] = useState([]);
  const [offline, setOffline] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const resposta = await api.listarMinhasTurmas();
      setTurmas(ordenarTurmas(resposta.turmas || []));
      setOffline(Boolean(resposta._offline));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const hoje = new Intl.DateTimeFormat('en-US', { timeZone: FUSO_BRASILIA, weekday: 'long' }).format(new Date());
  const hojeNumero = new Date().toLocaleDateString('en-US', { timeZone: FUSO_BRASILIA, weekday: 'short' });
  const mapaDia = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const diaAtual = mapaDia[hojeNumero] ?? 0;

  return (
    <View style={estilos.container}>
      <View style={estilos.topo}>
        <Text style={estilos.rotulo}>PLANEJAMENTO</Text>
        <Text style={estilos.titulo}>Agenda de aulas</Text>
        <Text style={estilos.subtitulo}>Sua semana organizada pelo horário de Brasília.</Text>
      </View>
      {offline && <Pulsar style={estilos.offline}><Text style={estilos.offlineTexto}>Sem conexão — mostrando sua agenda salva.</Text></Pulsar>}
      {carregando ? <ActivityIndicator color={cores.azul} style={estilos.carregando} /> : (
        <FlatList
          data={turmas}
          keyExtractor={(item) => item.atribuicao_id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={carregar} tintColor={cores.azul} />}
          contentContainerStyle={turmas.length ? estilos.lista : estilos.listaVazia}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma aula atribuída.</Text>}
          renderItem={({ item, index }) => {
            const dias = Array.isArray(item.dias_semana) ? item.dias_semana : [];
            const hoje = dias.includes(diaAtual);
            return (
              <AparecerEm atraso={index * 55}>
                <View style={[estilos.item, hoje && estilos.itemHoje]}>
                  <View style={estilos.hora}><Text style={estilos.horaTexto}>{String(item.hora_inicio).slice(0, 5)}</Text><Text style={estilos.horaFim}>{String(item.hora_fim).slice(0, 5)}</Text></View>
                  <View style={estilos.itemTexto}>
                    <Text style={estilos.turma}>{item.nome}</Text>
                    <Text style={estilos.materia}>{item.materia}</Text>
                    <Text style={estilos.dias}>{dias.map((dia) => DIAS[dia] || dia).join(' · ')}</Text>
                  </View>
                  {hoje && <View style={estilos.selo}><Text style={estilos.seloTexto}>Hoje</Text></View>}
                </View>
              </AparecerEm>
            );
          }}
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
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.surface, borderRadius: raio.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: cores.linha, ...sombra.cartao },
  itemHoje: { borderColor: cores.verde, borderLeftWidth: 4 },
  hora: { width: 54, borderRightWidth: 1, borderRightColor: cores.linha, marginRight: 13 },
  horaTexto: { color: cores.azul, fontSize: 15, fontWeight: '800' },
  horaFim: { color: cores.inkSoft, fontSize: 12, marginTop: 3 },
  itemTexto: { flex: 1 },
  turma: { color: cores.ink, fontSize: 14, fontWeight: '800' },
  materia: { color: cores.azul, fontSize: 13, fontWeight: '700', marginTop: 4 },
  dias: { color: cores.inkSoft, fontSize: 11.5, marginTop: 5 },
  selo: { backgroundColor: cores.verdeSoft, borderRadius: raio.pill, paddingHorizontal: 8, paddingVertical: 5 },
  seloTexto: { color: cores.verdeEscuro, fontSize: 11, fontWeight: '800' },
});
