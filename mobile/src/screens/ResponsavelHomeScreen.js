import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, obterNamespaceCache } from '../api';
import { obterFila, ouvirFila } from '../filaOffline';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import BarraNavegacao from '../components/BarraNavegacao';
import { Aviso, BotaoGrande, CabecalhoHome, FaixaEstado, Ficha, useBarraDeStatusEscura } from '../components/Ui';
import { dataHoje, formatarDataHora, rotuloDoDia, saudacaoDoDia } from '../datas';
import { cores, raio, sombra } from '../theme';

// Home do responsavel (MOB-001). Tudo que aparece aqui vem da API ou do cache
// da propria conta: nada de filho, status, aviso ou numero de exemplo. O que o
// backend ainda nao informa (presenca do dia na lista de filhos) simplesmente
// nao aparece, em vez de ser inventado.

function iniciais(nome = '') {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}

export default function ResponsavelHomeScreen({ navigation }) {
  const { usuario, logout } = useAuth();
  const insets = useSafeAreaInsets();
  useBarraDeStatusEscura();

  const [filhos, setFilhos] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');
  const [cacheEm, setCacheEm] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [pendentes, setPendentes] = useState([]);

  // Pendencias da fila offline desta conta.
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
      const resposta = await api.listarAlunos();
      const lista = resposta?.alunos || [];
      setFilhos(lista);
      setCacheEm(resposta?._offline ? resposta._cacheEm || null : null);
      setErro('');

      // Avisos sao por aluno; junta os de todos os filhos sem repetir.
      const respostasAvisos = await Promise.allSettled(lista.map((aluno) => api.avisosDoAluno(aluno.id)));
      const porId = new Map();
      respostasAvisos.forEach((resultado, indice) => {
        if (resultado.status !== 'fulfilled') return;
        (resultado.value?.avisos || []).forEach((aviso) => {
          if (!porId.has(aviso.id)) {
            porId.set(aviso.id, { ...aviso, alunoId: lista[indice].id, alunoNome: lista[indice].nome });
          }
        });
      });
      setAvisos([...porId.values()].sort((a, b) => new Date(b.publicado_em) - new Date(a.publicado_em)));
    } catch (err) {
      // 401 ja e tratado pelo AuthContext (MOB-005), que volta para o login.
      setErro(
        err?.offline
          ? 'Sem conexão e sem dados salvos neste aparelho. Conecte-se e puxe a tela para atualizar.'
          : err?.message || 'Não foi possível carregar seus filhos agora. Puxe a tela para tentar de novo.'
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  // Recarrega sempre que a tela volta ao foco (ex.: depois de adicionar um filho).
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function aoAtualizar() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  function sair() {
    const quantidade = pendentes.length;
    const mensagem = quantidade === 0
      ? 'Para entrar de novo, você vai precisar do e-mail e da senha.'
      : `${quantidade === 1 ? '1 ação ainda não enviada será apagada' : `${quantidade} ações ainda não enviadas serão apagadas`} deste aparelho. Toque em Sincronizar antes de sair para não perdê-las.`;
    Alert.alert('Sair da conta?', mensagem, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  function abrirFilho(filho) {
    if (!filho?.id) return;
    navigation.navigate('AlunoDetalhe', { alunoId: filho.id, nome: filho.nome });
  }

  function abrirAvisos(aviso) {
    if (!aviso?.alunoId) return;
    navigation.navigate('AlunoDetalhe', { alunoId: aviso.alunoId, nome: aviso.alunoNome, aba: 'avisos' });
  }

  const primeiroNome = usuario?.nome?.trim().split(/\s+/)[0];
  const ultimoAviso = avisos[0];

  return (
    <View style={estilos.tela}>
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingTop: insets.top + 16, paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={cores.azul} colors={[cores.azul, cores.verde]} />
        }
      >
        <CabecalhoHome
          papel="RESPONSÁVEL"
          titulo={`${saudacaoDoDia()}, ${primeiroNome || 'família'}`}
          subtitulo={rotuloDoDia(dataHoje())}
          nome={usuario?.nome}
          onSair={sair}
        />

        {cacheEm || pendentes.length > 0 ? (
          <AparecerEm atraso={90}>
            <FaixaEstado
              offlineEm={cacheEm}
              pendentes={pendentes.length}
              onSincronizar={() => navigation.navigate('Sincronizacao')}
            />
          </AparecerEm>
        ) : null}

        <Aviso tipo="erro" texto={filhos.length > 0 ? erro : ''} />

        <View style={estilos.metricas}>
          <Ficha rotulo="Filhos" valor={carregado ? filhos.length : '–'} atraso={130} />
          <Ficha rotulo="Avisos" valor={carregado ? avisos.length : '–'} atraso={200} destaque />
          <Ficha
            rotulo="Pendências"
            valor={pendentes.length}
            atraso={270}
            onPress={() => navigation.navigate('Sincronizacao')}
          />
        </View>

        <AparecerEm atraso={170} style={estilos.secaoLinha}>
          <Text style={estilos.secao}>Seus filhos</Text>
          <PressaoAnimada style={estilos.adicionarArea} onPress={() => navigation.navigate('AdicionarFilho')}>
            <Text style={estilos.adicionar}>+ Adicionar</Text>
          </PressaoAnimada>
        </AparecerEm>

        {!carregado ? (
          <ActivityIndicator color={cores.azul} style={estilos.carregando} />
        ) : erro && filhos.length === 0 ? (
          <View style={estilos.estadoCartao}>
            <Text style={estilos.estadoTitulo}>Não deu para carregar</Text>
            <Text style={estilos.estadoTexto}>{erro}</Text>
            <View style={estilos.estadoAcao}>
              <BotaoGrande texto="Tentar de novo" onPress={carregar} />
            </View>
          </View>
        ) : filhos.length === 0 ? (
          <View style={estilos.estadoCartao}>
            <Text style={estilos.estadoTitulo}>Nenhum filho vinculado ainda</Text>
            <Text style={estilos.estadoTexto}>Adicione seu filho com a matrícula informada pela escola.</Text>
            <View style={estilos.estadoAcao}>
              <BotaoGrande texto="Adicionar filho" onPress={() => navigation.navigate('AdicionarFilho')} />
            </View>
          </View>
        ) : (
          filhos.map((filho, indice) => (
            <AparecerEm key={filho.id} atraso={210 + indice * 70}>
              <PressaoAnimada style={estilos.cartao} onPress={() => abrirFilho(filho)}>
                <View style={estilos.avatarFilho}>
                  <Text style={estilos.avatarFilhoTexto}>{iniciais(filho.nome)}</Text>
                </View>
                <View style={estilos.filhoTexto}>
                  <Text style={estilos.nome}>{filho.nome}</Text>
                  <Text style={estilos.detalhe}>
                    {[filho.turma_nome || 'Sem turma', filho.filial_nome].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={estilos.seta}>
                  <Text style={estilos.setaTexto}>›</Text>
                </View>
              </PressaoAnimada>
            </AparecerEm>
          ))
        )}

        {ultimoAviso ? (
          <AparecerEm atraso={360} style={estilos.aviso}>
            <Text style={estilos.rotuloAviso}>ÚLTIMO AVISO · {formatarDataHora(ultimoAviso.publicado_em)}</Text>
            <Text style={estilos.tituloAviso}>{ultimoAviso.titulo}</Text>
            {ultimoAviso.mensagem ? (
              <Text style={estilos.detalheAviso} numberOfLines={2}>{ultimoAviso.mensagem}</Text>
            ) : null}
            <PressaoAnimada style={estilos.verAvisosArea} onPress={() => abrirAvisos(ultimoAviso)}>
              <Text style={estilos.verAvisos}>Ver avisos de {ultimoAviso.alunoNome} →</Text>
            </PressaoAnimada>
          </AparecerEm>
        ) : null}
      </ScrollView>

      <View style={estilos.navegacao}>
        <BarraNavegacao
          itens={[
            { chave: 'filhos', rotulo: 'Filhos', icone: 'people', ativo: true },
            { chave: 'avisos', rotulo: 'Avisos', icone: 'notifications', desabilitado: !ultimoAviso, onPress: () => abrirAvisos(ultimoAviso) },
            { chave: 'aluno', rotulo: 'Aluno', icone: 'person', desabilitado: !filhos[0]?.id, onPress: () => abrirFilho(filhos[0]) },
            { chave: 'sincronizar', rotulo: 'Sincronizar', icone: 'sync', onPress: () => navigation.navigate('Sincronizacao') },
          ]}
          central={{ rotulo: 'Adicionar', icone: 'add', onPress: () => navigation.navigate('AdicionarFilho') }}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20, gap: 14 },
  metricas: { flexDirection: 'row', gap: 10 },
  secaoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  secao: { color: cores.inkSoft, fontSize: 13, fontWeight: '700' },
  // 44px e o alvo minimo de toque; este era um texto de 10px sem area nenhuma.
  adicionarArea: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, marginRight: -8 },
  adicionar: { color: cores.azul, fontSize: 13, fontWeight: '800' },
  carregando: { marginVertical: 24 },
  estadoCartao: { backgroundColor: cores.surface, borderRadius: raio.lg, borderWidth: 1, borderColor: cores.linha, padding: 18, alignItems: 'center', ...sombra.cartao },
  estadoTitulo: { color: cores.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  estadoTexto: { color: cores.inkSoft, fontSize: 13, marginTop: 5, textAlign: 'center', lineHeight: 19 },
  estadoAcao: { alignSelf: 'stretch', marginTop: 14 },
  // Medidas do cartao de turma do professor: raio lg, padding 14.
  cartao: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.surface, borderRadius: raio.lg, borderWidth: 1, borderColor: cores.linha, padding: 14, ...sombra.cartao },
  avatarFilho: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: cores.azulSoft },
  avatarFilhoTexto: { fontSize: 13, fontWeight: '800', color: cores.azul },
  filhoTexto: { flex: 1 },
  nome: { color: cores.ink, fontSize: 14, fontWeight: '800' },
  detalhe: { color: cores.inkSoft, fontSize: 12, marginTop: 2 },
  seta: { width: 26, height: 26, borderRadius: 13, backgroundColor: cores.verdeSoft, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { color: cores.verde, fontSize: 18, fontWeight: '800', marginTop: -2 },
  aviso: { backgroundColor: cores.surface, borderRadius: raio.lg, borderWidth: 1, borderColor: cores.linha, padding: 15, ...sombra.cartao },
  rotuloAviso: { color: cores.inkSoft, fontSize: 11, letterSpacing: 1.1, fontWeight: '700' },
  tituloAviso: { color: cores.ink, fontSize: 15, fontWeight: '800', marginTop: 6 },
  detalheAviso: { color: cores.inkSoft, fontSize: 13, marginTop: 4, lineHeight: 18 },
  verAvisosArea: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  verAvisos: { color: cores.azul, fontSize: 13, fontWeight: '800' },
  navegacao: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
