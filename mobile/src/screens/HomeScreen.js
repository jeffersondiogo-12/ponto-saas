import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme';

export default function HomeScreen({ navigation }) {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const { logout } = useAuth();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { alunos: lista } = await api.listarAlunos();
      setAlunos(lista);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return (
    <View style={estilos.container}>
      <View style={estilos.topo}>
        <Text style={estilos.titulo}>Seus filhos</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={estilos.sair}>Sair</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={alunos}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          !carregando && (
            <Text style={estilos.vazio}>Nenhum filho vinculado ainda. Fale com a secretaria da escola.</Text>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={estilos.cartao}
            onPress={() => navigation.navigate('AlunoDetalhe', { alunoId: item.id, nome: item.nome })}
          >
            <Text style={estilos.nomeAluno}>{item.nome}</Text>
            <Text style={estilos.detalheAluno}>
              {item.turma_nome || 'Sem turma'} · {item.filial_nome}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.paper },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  titulo: { fontSize: 22, fontWeight: '700', color: cores.ink },
  sair: { color: cores.inkSoft, fontSize: 13, textDecorationLine: 'underline' },
  cartao: {
    backgroundColor: cores.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: cores.brass,
    padding: 16,
    marginBottom: 12,
  },
  nomeAluno: { fontSize: 16, fontWeight: '600', color: cores.ink },
  detalheAluno: { fontSize: 13, color: cores.inkSoft, marginTop: 4 },
  vazio: { textAlign: 'center', color: cores.inkSoft, marginTop: 40, fontSize: 14 },
});
