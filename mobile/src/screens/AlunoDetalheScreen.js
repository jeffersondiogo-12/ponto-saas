import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api';
import { cores } from '../theme';

function formatarDataHora(iso) {
  const data = new Date(iso);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AlunoDetalheScreen({ route }) {
  const { alunoId, nome } = route.params;
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.frequenciaDoAluno(alunoId).then((r) => {
      setRegistros(r.registros);
      setCarregando(false);
    });
  }, [alunoId]);

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>{nome}</Text>
      <Text style={estilos.subtitulo}>Histórico de chegada e saída</Text>

      {carregando ? (
        <ActivityIndicator color={cores.brass} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={registros}
          keyExtractor={(item, indice) => `${item.data_hora}-${indice}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhum registro ainda.</Text>}
          renderItem={({ item, index }) => {
            // Mesma logica par/impar do backend: 1a batida do dia = chegada,
            // 2a = saida - so pra rotular aqui na lista (mais recente primeiro).
            const tipo = index % 2 === 0 ? 'Chegada' : 'Saída';
            return (
              <View style={estilos.linha}>
                <View style={[estilos.ponto, tipo === 'Chegada' ? estilos.pontoVerde : estilos.pontoVermelho]} />
                <Text style={estilos.tipoTexto}>{tipo}</Text>
                <Text style={estilos.dataTexto}>{formatarDataHora(item.data_hora)}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.paper, paddingTop: 60 },
  titulo: { fontSize: 20, fontWeight: '700', color: cores.ink, paddingHorizontal: 20 },
  subtitulo: { fontSize: 13, color: cores.inkSoft, paddingHorizontal: 20, marginBottom: 16 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  ponto: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  pontoVerde: { backgroundColor: cores.sinalVerde },
  pontoVermelho: { backgroundColor: cores.sinalVermelho },
  tipoTexto: { flex: 1, fontSize: 14, fontWeight: '600', color: cores.ink },
  dataTexto: { fontSize: 13, color: cores.inkSoft, fontVariant: ['tabular-nums'] },
  vazio: { textAlign: 'center', color: cores.inkSoft, marginTop: 40 },
});
