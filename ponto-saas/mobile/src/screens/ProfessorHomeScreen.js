import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme';

export default function ProfessorHomeScreen({ navigation }) {
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const { logout } = useAuth();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { turmas: lista } = await api.listarTurmasProfessor();
      setTurmas(lista || []);
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
        <Text style={estilos.titulo}>Minhas turmas</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={estilos.sair}>Sair</Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <ActivityIndicator color={cores.brass} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={turmas}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma turma atribuída.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={estilos.cartao} onPress={() => navigation.navigate('ProfessorTurmaChamada', { turma: item })}>
              <Text style={estilos.nomeTurma}>{item.nome}</Text>
              <Text style={estilos.detalheTurma}>{item.turno || 'Turno'} · {item.filial_nome || 'Unidade'}</Text>
              <Text style={estilos.detalheTurma}>Ano letivo: {item.ano_letivo || '--'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
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
  nomeTurma: { fontSize: 16, fontWeight: '600', color: cores.ink },
  detalheTurma: { fontSize: 13, color: cores.inkSoft, marginTop: 4 },
  vazio: { textAlign: 'center', color: cores.inkSoft, marginTop: 40, fontSize: 14 },
});
