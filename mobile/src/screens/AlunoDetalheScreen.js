import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, DeviceEventEmitter } from 'react-native';
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

function formatarData(iso) {
  const data = new Date(iso);
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ABAS = [
  { chave: 'frequencia', rotulo: 'Frequência' },
  { chave: 'notas', rotulo: 'Notas' },
  { chave: 'observacoes', rotulo: 'Observações' },
];

export default function AlunoDetalheScreen({ route }) {
  const { alunoId, nome } = route.params;
  const [aba, setAba] = useState('frequencia');
  const [registros, setRegistros] = useState([]);
  const [notas, setNotas] = useState([]);
  const [observacoes, setObservacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const [frequencia, notasResposta, observacoesResposta] = await Promise.all([
      api.frequenciaDoAluno(alunoId),
      api.notasDoAluno(alunoId),
      api.observacoesDoAluno(alunoId),
    ]);
    setRegistros(frequencia.registros);
    setNotas(notasResposta.notas);
    setObservacoes(observacoesResposta.observacoes);
    setCarregando(false);
  }, [alunoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O professor pode lancar presenca/nota/observacao pra este aluno enquanto
  // a tela esta aberta - o realtime.js emite esse evento local e a gente so
  // recarrega quando for sobre ESTE aluno (ver conectarRealtime em App.js).
  useEffect(() => {
    const assinatura = DeviceEventEmitter.addListener('ponto-saas:atualizado', (mensagem) => {
      if (mensagem?.dados?.alunoId === alunoId) carregar();
    });
    return () => assinatura.remove();
  }, [alunoId, carregar]);

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>{nome}</Text>

      <View style={estilos.seletor}>
        {ABAS.map((item) => (
          <TouchableOpacity
            key={item.chave}
            style={[estilos.opcao, aba === item.chave && estilos.opcaoAtiva]}
            onPress={() => setAba(item.chave)}
          >
            <Text style={[estilos.opcaoTexto, aba === item.chave && estilos.opcaoTextoAtivo]}>
              {item.rotulo}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {carregando ? (
        <ActivityIndicator color={cores.brass} style={{ marginTop: 30 }} />
      ) : aba === 'frequencia' ? (
        <FlatList
          data={registros}
          keyExtractor={(item, indice) => `${item.data_hora}-${indice}`}
          contentContainerStyle={estilos.lista}
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
      ) : aba === 'notas' ? (
        <FlatList
          data={notas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={estilos.lista}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma nota lançada ainda.</Text>}
          renderItem={({ item }) => (
            <View style={estilos.cartao}>
              <View style={estilos.notaTopo}>
                <Text style={estilos.cartaoTitulo}>{item.disciplina}</Text>
                <Text style={estilos.valorNota}>{item.nota != null ? Number(item.nota).toFixed(1) : '—'}</Text>
              </View>
              <Text style={estilos.notaEtapa}>{item.etapa} · {formatarData(item.created_at)}</Text>
              {item.observacao ? <Text style={estilos.cartaoTexto}>{item.observacao}</Text> : null}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={observacoes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={estilos.lista}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma observação enviada ainda.</Text>}
          renderItem={({ item }) => (
            <View style={estilos.cartao}>
              <Text style={estilos.cartaoTitulo}>{item.titulo}</Text>
              <Text style={estilos.cartaoTexto}>{item.texto}</Text>
              <Text style={estilos.cartaoRodape}>
                {item.autor_nome ? `${item.autor_nome} · ` : ''}
                {formatarDataHora(item.created_at)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.paper, paddingTop: 60 },
  titulo: { fontSize: 20, fontWeight: '700', color: cores.ink, paddingHorizontal: 20, marginBottom: 14 },
  seletor: {
    flexDirection: 'row',
    backgroundColor: cores.surface,
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  opcao: { flex: 1, paddingVertical: 9, borderRadius: 7, alignItems: 'center' },
  opcaoAtiva: { backgroundColor: cores.brassSoft },
  opcaoTexto: { color: cores.inkSoft, fontWeight: '600', fontSize: 12.5 },
  opcaoTextoAtivo: { color: cores.brass },
  lista: { paddingHorizontal: 20, paddingBottom: 20 },
  cartao: {
    backgroundColor: cores.surface,
    borderRadius: 10,
    borderTopWidth: 3,
    borderTopColor: cores.brass,
    padding: 14,
    marginBottom: 8,
  },
  notaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: cores.ink },
  valorNota: { fontSize: 18, fontWeight: '700', color: cores.brass, fontVariant: ['tabular-nums'] },
  notaEtapa: { fontSize: 12.5, color: cores.inkSoft, marginTop: 3 },
  cartaoTexto: { fontSize: 13.5, color: cores.ink, marginTop: 8, lineHeight: 19 },
  cartaoRodape: { fontSize: 12, color: cores.inkSoft, marginTop: 8 },
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
