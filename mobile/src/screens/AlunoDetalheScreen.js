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
  const [painel, setPainel] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.painelDoAluno(alunoId).then(setPainel).catch((err) => setErro(err.message)).finally(() => setCarregando(false));
  }, [alunoId]);

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>{nome}</Text>
      <Text style={estilos.subtitulo}>Acompanhamento escolar</Text>

      {carregando ? (
        <ActivityIndicator color={cores.brass} style={{ marginTop: 30 }} />
      ) : erro ? (
        <Text style={estilos.erro}>{erro}</Text>
      ) : (
        <FlatList data={painel.presenca} keyExtractor={(item, indice) => `${item.data_hora}-${indice}`} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          ListHeaderComponent={<View>
            <Secao titulo="Avisos da escola" itens={painel.avisos} renderItem={(item) => <Text style={estilos.texto}>{item.titulo}: {item.mensagem}</Text>} vazio="Nenhum aviso no momento." />
            <Secao titulo="Notas" itens={painel.notas} renderItem={(item) => <Text style={estilos.texto}>{item.disciplina} · {item.etapa}: {item.nota ?? 'Sem nota'}{item.observacao ? ` · ${item.observacao}` : ''}</Text>} vazio="Nenhuma nota lançada." />
            <Secao titulo="Observações" itens={painel.observacoes} renderItem={(item) => <Text style={estilos.texto}>{item.titulo}: {item.texto}</Text>} vazio="Nenhuma observação registrada." />
            <Text style={estilos.secaoTitulo}>Presença na escola</Text>
          </View>}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhum registro de presença ainda.</Text>}
          renderItem={({ item, index }) => {
            const tipo = index % 2 === 0 ? 'Chegada' : 'Saída';
            return <View style={estilos.linha}><View style={[estilos.ponto, tipo === 'Chegada' ? estilos.pontoVerde : estilos.pontoVermelho]} /><Text style={estilos.tipoTexto}>{tipo}</Text><Text style={estilos.dataTexto}>{formatarDataHora(item.data_hora)}</Text></View>;
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
  erro: { color: cores.sinalVermelho, padding: 20 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: cores.ink, marginTop: 14, marginBottom: 8 },
  secao: { backgroundColor: cores.surface, borderRadius: 10, padding: 14, marginBottom: 10 },
  texto: { color: cores.inkSoft, lineHeight: 20, marginBottom: 6 },
});

function Secao({ titulo, itens, renderItem, vazio }) {
  return <View><Text style={estilos.secaoTitulo}>{titulo}</Text><View style={estilos.secao}>{itens.length ? itens.map((item) => <View key={item.id}>{renderItem(item)}</View>) : <Text style={estilos.texto}>{vazio}</Text>}</View></View>;
}
