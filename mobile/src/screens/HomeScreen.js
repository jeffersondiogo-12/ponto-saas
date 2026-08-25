import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { obterFila, ouvirFila } from '../filaOffline';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada, Pulsar } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

function iniciais(nome = '') {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() || '')
    .join('');
}

export default function HomeScreen({ navigation }) {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [offline, setOffline] = useState(false);
  const [pendentes, setPendentes] = useState([]);
  const { logout } = useAuth();

  useEffect(() => {
    obterFila().then(setPendentes);
    return ouvirFila(setPendentes);
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await api.listarAlunos();
      setAlunos(resposta.alunos);
      setOffline(Boolean(resposta._offline));
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
        <AparecerEm>
          <Text style={estilos.saudacao}>Ponte·Escolar</Text>
          <Text style={estilos.titulo}>Seus filhos</Text>
        </AparecerEm>
        <AparecerEm atraso={80} style={estilos.acoesTopo}>
          <PressaoAnimada style={estilos.botaoAdicionar} onPress={() => navigation.navigate('AdicionarFilho')}>
            <Text style={estilos.adicionar}>+ Filho</Text>
          </PressaoAnimada>
          <PressaoAnimada style={estilos.botaoSair} onPress={logout}>
            <Text style={estilos.sair}>Sair</Text>
          </PressaoAnimada>
        </AparecerEm>
      </View>

      {offline ? (
        <Pulsar style={estilos.faixaOffline}>
          <Text style={estilos.faixaOfflineTexto}>
            Sem conexão — mostrando os filhos salvos no aparelho.
          </Text>
        </Pulsar>
      ) : null}
      {pendentes.length > 0 ? (
        <Pulsar style={estilos.faixaPendente}>
          <Text style={estilos.faixaPendenteTexto}>
            {pendentes.length === 1
              ? '1 ação aguardando conexão para ser enviada.'
              : `${pendentes.length} ações aguardando conexão para serem enviadas.`}
          </Text>
        </Pulsar>
      ) : null}

      <FlatList
        data={alunos}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} tintColor={cores.azul} colors={[cores.azul, cores.verde]} />
        }
        contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
        ListEmptyComponent={
          !carregando && (
            <AparecerEm style={estilos.vazioCaixa}>
              <View style={estilos.vazioIcone}>
                <Text style={estilos.vazioIconeTexto}>+</Text>
              </View>
              <Text style={estilos.vazio}>Nenhum filho vinculado ainda.</Text>
              <PressaoAnimada
                style={estilos.botaoVazio}
                onPress={() => navigation.navigate('AdicionarFilho')}
              >
                <Text style={estilos.botaoVazioTexto}>Adicionar filho</Text>
              </PressaoAnimada>
            </AparecerEm>
          )
        }
        renderItem={({ item, index }) => (
          <AparecerEm atraso={index * 70}>
            <PressaoAnimada
              style={estilos.cartao}
              onPress={() => navigation.navigate('AlunoDetalhe', { alunoId: item.id, nome: item.nome })}
            >
              <View style={estilos.avatar}>
                <Text style={estilos.avatarTexto}>{iniciais(item.nome)}</Text>
              </View>
              <View style={estilos.cartaoTexto}>
                <Text style={estilos.nomeAluno}>{item.nome}</Text>
                <Text style={estilos.detalheAluno}>
                  {item.turma_nome || 'Sem turma'} · {item.filial_nome}
                </Text>
              </View>
              <View style={estilos.seta}>
                <Text style={estilos.setaTexto}>›</Text>
              </View>
            </PressaoAnimada>
          </AparecerEm>
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
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 18,
  },
  saudacao: { color: cores.azul, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  titulo: { fontSize: 26, fontWeight: '800', color: cores.ink, letterSpacing: -0.5, marginTop: 4 },
  acoesTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botaoAdicionar: {
    backgroundColor: cores.azulSoft,
    borderRadius: raio.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  adicionar: { color: cores.azul, fontSize: 13, fontWeight: '800' },
  botaoSair: { paddingHorizontal: 8, paddingVertical: 9 },
  sair: { color: cores.inkSoft, fontSize: 13, fontWeight: '600' },
  faixaOffline: {
    backgroundColor: cores.surface,
    borderLeftWidth: 3,
    borderLeftColor: cores.inkSoft,
    padding: 12,
    borderRadius: raio.sm,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  faixaOfflineTexto: { color: cores.inkSoft, fontSize: 12.5 },
  faixaPendente: {
    backgroundColor: cores.verdeSoft,
    borderLeftWidth: 3,
    borderLeftColor: cores.verde,
    padding: 12,
    borderRadius: raio.sm,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  faixaPendenteTexto: { color: cores.verdeEscuro, fontSize: 12.5, fontWeight: '700' },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.surface,
    borderRadius: raio.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: cores.linha,
    ...sombra.cartao,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: cores.azulSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  avatarTexto: { color: cores.azul, fontWeight: '800', fontSize: 15 },
  cartaoTexto: { flex: 1 },
  nomeAluno: { fontSize: 16, fontWeight: '700', color: cores.ink },
  detalheAluno: { fontSize: 13, color: cores.inkSoft, marginTop: 4 },
  seta: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: cores.verdeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setaTexto: { color: cores.verde, fontSize: 18, fontWeight: '800', marginTop: -2 },
  vazioCaixa: { alignItems: 'center', marginTop: 60 },
  vazioIcone: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: cores.azulSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  vazioIconeTexto: { color: cores.azul, fontSize: 30, fontWeight: '300', marginTop: -4 },
  vazio: { textAlign: 'center', color: cores.inkSoft, fontSize: 14 },
  botaoVazio: {
    backgroundColor: cores.azul,
    borderRadius: raio.sm,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 18,
    ...sombra.destaque,
  },
  botaoVazioTexto: { color: cores.claro, fontWeight: '800' },
});
