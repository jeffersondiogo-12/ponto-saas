import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { api } from '../api';
import { cores } from '../theme';

const opcoesStatus = ['presente', 'ausente', 'atrasado', 'justificado', 'pendente'];

export default function ProfessorTurmaChamadaScreen({ route, navigation }) {
  const { turma } = route.params || {};
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    async function carregarLista() {
      setCarregando(true);
      try {
        const resposta = await api.listarChamadaProfessor({ turma_id: turma.id, data });
        const lista = [...(resposta.alunos || [])].sort((a, b) => a.nome.localeCompare(b.nome));
        setAlunos(lista);
      } catch (err) {
        Alert.alert('Erro', err.message || 'Não foi possível carregar a turma.');
      } finally {
        setCarregando(false);
      }
    }

    if (turma?.id) {
      carregarLista();
    }
  }, [turma, data]);

  function alterarStatus(alunoId, status) {
    setAlunos((atual) =>
      atual.map((aluno) => (aluno.id === alunoId ? { ...aluno, status } : aluno))
    );
  }

  async function salvar() {
    try {
      await api.salvarChamadaProfessor({
        turma_id: turma.id,
        data,
        presencas: alunos.map((aluno) => ({
          aluno_id: aluno.id,
          status: aluno.status || 'presente',
        })),
      });
      Alert.alert('Sucesso', 'Chamada salva com sucesso.');
    } catch (err) {
      Alert.alert('Erro', err.message || 'Não foi possível salvar a chamada.');
    }
  }

  return (
    <View style={estilos.container}>
      <View style={estilos.topo}>
        <Text style={estilos.titulo}>{turma?.nome || 'Turma'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={estilos.voltar}>Voltar</Text>
        </TouchableOpacity>
      </View>

      <Text style={estilos.subtitulo}>Data da chamada: {data}</Text>

      {carregando ? (
        <ActivityIndicator color={cores.brass} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={alunos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhum aluno nesta turma.</Text>}
          renderItem={({ item }) => (
            <View style={estilos.cartao}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {item.foto_url ? (
                  <Image source={{ uri: item.foto_url }} style={estilos.foto} />
                ) : (
                  <View style={estilos.fotoFallback}>
                    <Text style={estilos.fotoFallbackTexto}>{item.nome?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={estilos.nome}>{item.nome}</Text>
                  <Text style={estilos.detalhe}>Matrícula: {item.matricula || '--'}</Text>
                  <Text style={estilos.detalhe}>Período: {item.horario_entrada || '--'} / {item.horario_saida || '--'}</Text>
                </View>
              </View>

              <View style={estilos.statusArea}>
                {opcoesStatus.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[estilos.statusBotao, item.status === status && estilos.statusBotaoAtivo]}
                    onPress={() => alterarStatus(item.id, status)}
                  >
                    <Text style={[estilos.statusTexto, item.status === status && estilos.statusTextoAtivo]}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <View style={estilos.footer}>
        <TouchableOpacity style={estilos.botaoSalvar} onPress={salvar}>
          <Text style={estilos.botaoSalvarTexto}>Salvar chamada</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.paper },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  titulo: { fontSize: 22, fontWeight: '700', color: cores.ink },
  voltar: { color: cores.inkSoft, fontSize: 13, textDecorationLine: 'underline' },
  subtitulo: { fontSize: 13, color: cores.inkSoft, paddingHorizontal: 20, marginBottom: 10 },
  cartao: { backgroundColor: cores.surface, borderRadius: 12, padding: 14, marginBottom: 12 },
  nome: { fontSize: 16, fontWeight: '600', color: cores.ink },
  detalhe: { fontSize: 12, color: cores.inkSoft, marginTop: 3 },
  foto: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ddd' },
  fotoFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  fotoFallbackTexto: { color: '#374151', fontWeight: '700' },
  statusArea: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 8 },
  statusBotao: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  statusBotaoAtivo: { backgroundColor: cores.sinalVerdeSoft, borderWidth: 1, borderColor: cores.sinalVerde },
  statusTexto: { textTransform: 'capitalize', color: cores.inkSoft, fontSize: 12 },
  statusTextoAtivo: { color: cores.sinalVerde, fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#ece7df', backgroundColor: '#fff' },
  botaoSalvar: { backgroundColor: cores.brass, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  botaoSalvarTexto: { color: '#fff', fontWeight: '700' },
  vazio: { textAlign: 'center', color: cores.inkSoft, marginTop: 40 },
});
