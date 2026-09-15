import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api, obterNamespaceCache } from '../api';
import { obterFila, ouvirFila } from '../filaOffline';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { Aviso, BotaoGrande, CabecalhoHome, Cartao, FaixaEstado, Ficha, useBarraDeStatusEscura } from '../components/Ui';
import { dataHoje, rotuloDoDia, saudacaoDoDia } from '../datas';
import { cores, raio, sombra } from '../theme';

export default function InicioScreen({ navigation }) {
  const { usuario, logout } = useAuth();
  const primeiroNome = usuario?.nome?.trim().split(/\s+/)[0];
  const insets = useSafeAreaInsets();
  useBarraDeStatusEscura();
  const [turmas, setTurmas] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [offline, setOffline] = useState(false);
  const [cacheEm, setCacheEm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [hoje, setHoje] = useState(dataHoje);

  useFocusEffect(
    useCallback(() => {
      setHoje(dataHoje());
    }, []),
  );

  useEffect(() => {
    let ativo = true;
    let parar = () => {};
    obterNamespaceCache().then((namespace) => {
      if (!ativo || !namespace) return;
      obterFila(namespace).then((itens) => {
        if (ativo) setPendentes(itens);
      });
      parar = ouvirFila(namespace, setPendentes);
    });
    return () => {
      ativo = false;
      parar();
    };
  }, []);

  const carregar = useCallback(async () => {
    try {
      const [respostaTurmas, respostaResumo] = await Promise.all([
        api.listarMinhasTurmas(),
        api.resumoProfessor().catch(() => ({ resumo: [] })),
      ]);
      setTurmas(respostaTurmas.turmas || []);
      setResumo(respostaResumo.resumo || []);
      setOffline(Boolean(respostaTurmas._offline));
      setCacheEm(respostaTurmas._offline ? respostaTurmas._cacheEm || null : null);
      setErro('');
    } catch (err) {
      if (err?.status === 401) return logout();
      setErro(err?.message || 'Não foi possível carregar seus dados agora.');
    } finally {
      setCarregando(false);
    }
  }, [logout]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O gestor pode atribuir ou tirar uma turma com o app aberto no Início.
  useEffect(() => {
    const assinatura = DeviceEventEmitter.addListener('ponto-saas:atualizado', (mensagem) => {
      if (mensagem?.tipo === 'turma.atribuida') carregar();
    });
    return () => assinatura.remove();
  }, [carregar]);

  async function aoAtualizar() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  function sair() {
    const quantidade = pendentes.length;
    const mensagem = quantidade === 0
      ? 'Para entrar de novo, você vai precisar do seu usuário e da senha.'
      : `${quantidade === 1 ? '1 ação ainda não enviada será apagada' : `${quantidade} ações ainda não enviadas serão apagadas`} deste aparelho. Toque em Sincronizar antes de sair para não perdê-las.`;
    Alert.alert('Sair da conta?', mensagem, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  const presentes = resumo.reduce((total, linha) => total + (Number(linha.presentes_facial) || 0), 0);
  const alunos = resumo.reduce((total, linha) => total + (Number(linha.total_alunos) || 0), 0);

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cores.azul} />
      </View>
    );
  }

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.conteudo, { paddingTop: insets.top + 20 }]}
      refreshControl={
        <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={cores.azul} colors={[cores.azul, cores.verde]} />
      }
    >
      <CabecalhoHome
        papel="PROFESSOR"
        titulo={`${saudacaoDoDia()}, ${primeiroNome || 'professor'}`}
        subtitulo={rotuloDoDia(hoje)}
        nome={usuario?.nome}
        onSair={sair}
      />

      <FaixaEstado
        offlineEm={cacheEm}
        offline={offline}
        pendentes={pendentes.length}
        onSincronizar={() => navigation.navigate('sincronizar')}
      />
      <Aviso tipo="erro" texto={erro} />

      <View style={estilos.fichas}>
        <Ficha rotulo="Turmas" valor={turmas.length} atraso={0} onPress={() => navigation.navigate('agenda')} />
        <Ficha rotulo="Presentes hoje" valor={`${presentes}/${alunos}`} atraso={70} destaque onPress={() => navigation.navigate('relatorios')} />
        <Ficha rotulo="Pendências" valor={pendentes.length} atraso={140} onPress={() => navigation.navigate('sincronizar')} />
      </View>

      <BotaoGrande texto="Fazer chamada" onPress={() => navigation.navigate('chamada')} />

      <View style={estilos.atalhos}>
        <PressaoAnimada style={estilos.atalho} onPress={() => navigation.navigate('Notas')} escala={0.97}>
          <Text style={estilos.atalhoTitulo}>Notas</Text>
          <Text style={estilos.atalhoTexto}>Lançar avaliações</Text>
        </PressaoAnimada>
        <PressaoAnimada style={estilos.atalho} onPress={() => navigation.navigate('Observacoes')} escala={0.97}>
          <Text style={estilos.atalhoTitulo}>Observações</Text>
          <Text style={estilos.atalhoTexto}>Recados ao responsável</Text>
        </PressaoAnimada>
      </View>

      <Text style={estilos.secao}>Chamada do dia</Text>
      {turmas.length === 0 ? (
        <Cartao>
          <Text style={estilos.vazio}>Nenhuma turma atribuída pelo gestor ainda.</Text>
        </Cartao>
      ) : (
        turmas.slice(0, 4).map((item, indice) => {
          const linha = resumo.find((dado) => dado.atribuicao_id === item.atribuicao_id);
          return (
            <AparecerEm key={item.atribuicao_id} atraso={indice * 60} deslocamento={10}>
              <PressaoAnimada style={estilos.linhaTurma} onPress={() => navigation.navigate('chamada')} escala={0.98}>
                <View style={estilos.linhaTextos}>
                  <Text style={estilos.linhaNome}>{item.nome}</Text>
                  <Text style={estilos.linhaDetalhe}>{item.materia}</Text>
                </View>
                <View style={estilos.selo}>
                  <Text style={estilos.seloTexto}>
                    {linha ? `${linha.presentes_facial}/${linha.total_alunos}` : 'Abrir'}
                  </Text>
                </View>
              </PressaoAnimada>
            </AparecerEm>
          );
        })
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20, paddingBottom: 32, gap: 14 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.paper },
  fichas: { flexDirection: 'row', gap: 10 },
  atalhos: { flexDirection: 'row', gap: 10 },
  atalho: {
    flex: 1,
    padding: 14,
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.surface,
    ...sombra.cartao,
  },
  atalhoTitulo: { fontWeight: '800', color: cores.ink },
  atalhoTexto: { fontSize: 11, color: cores.inkSoft, marginTop: 2 },
  secao: { fontSize: 13, fontWeight: '700', color: cores.inkSoft, marginTop: 6 },
  // Sem marginBottom: cada turma e filha direta do container, que ja tem
  // gap 14. Os dois somados davam 24px entre os blocos.
  linhaTurma: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.surface,
  },
  linhaTextos: { flex: 1 },
  linhaNome: { fontWeight: '800', color: cores.ink },
  linhaDetalhe: { fontSize: 12, color: cores.inkSoft, marginTop: 2 },
  selo: { backgroundColor: cores.azulSoft, borderRadius: raio.md, paddingHorizontal: 10, paddingVertical: 6 },
  seloTexto: { color: cores.azul, fontWeight: '800', fontSize: 12 },
  vazio: { color: cores.inkSoft, textAlign: 'center' },
});
