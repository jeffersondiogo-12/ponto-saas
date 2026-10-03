import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, obterNamespaceCache } from '../api';
import { obterFila, ouvirFila } from '../filaOffline';
import { useAuth } from '../context/AuthContext';
import { useRecarregarAoVivo } from '../realtime';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import BarraNavegacao from '../components/BarraNavegacao';
import { Aviso, BotaoGrande, CabecalhoHome, FaixaEstado, Ficha, useBarraDeStatusEscura } from '../components/Ui';
import { prepararRegistros } from '../batidas';
import { dataHoje, formatarDataHora, rotuloDoDia, saudacaoDoDia } from '../datas';
import {
  avisosLidos, contarAvisosNaoLidos, fichaVistaEm, marcarFichaVista, resumoDoFilho, rotuloDaPassagem,
} from '../novidades';
import { cores, raio, sombra } from '../theme';

// Home do responsavel (MOB-001), com as mudancas das tarefas #55 e #56 - as
// mesmas do PWA (web/src/app/responsavel/HomeResponsavel.jsx): os tres numeros
// so leitura e da mesma cor, sem o cartao "Ultimo aviso" (aviso agora so dentro
// da ficha de cada filho), sem o "+ Adicionar" ao lado de "Seus filhos" (so o
// botao da barra), e cada filho com a ultima passagem e o que chegou de novo.
//
// Tudo que aparece aqui vem da API ou do cache da propria conta: nada de filho,
// status, aviso ou numero de exemplo. O que o backend nao informa nao aparece.

// Eventos que mudam algum card. O useRecarregarAoVivo espera 1,5 s e junta rajadas.
const EVENTOS = ['ponto.criado', 'nota.criada', 'observacao.criada', 'aviso.lancado', 'aviso.atualizado', 'aviso.removido'];

/**
 * Inicio da janela da "ultima passagem": 7 dias, contando hoje. Vai ao
 * meio-dia de Brasilia porque o backend le a data como instante - meia-noite
 * UTC cairia no dia anterior.
 */
function seteDiasAtras() {
  const [ano, mes, dia] = dataHoje().split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, dia - 6)).toISOString().slice(0, 10);
  return `${inicio}T12:00:00-03:00`;
}

const lista = (resultado, campo) => (resultado.status === 'fulfilled' ? resultado.value?.[campo] || [] : []);

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
  const [porFilho, setPorFilho] = useState({});
  const [lidos, setLidos] = useState(() => new Set());
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
      const alunos = resposta?.alunos || [];
      const namespace = await obterNamespaceCache();
      const de = seteDiasAtras();

      const dados = await Promise.all(alunos.map(async (aluno) => {
        const [frequencia, avisos, notas, observacoes] = await Promise.allSettled([
          api.frequenciaDoAluno(aluno.id, { de }),
          api.avisosDoAluno(aluno.id),
          api.notasDoAluno(aluno.id),
          api.observacoesDoAluno(aluno.id),
        ]);
        // Marco zero do "novo": a primeira vez que a Home carrega neste aparelho.
        let vistaEm = await fichaVistaEm(namespace, aluno.id);
        if (vistaEm == null) {
          vistaEm = Date.now();
          await marcarFichaVista(namespace, aluno.id, vistaEm);
        }
        return [aluno.id, {
          // null = nao deu para buscar (sem internet): a linha some, em vez de
          // dizer "nenhuma passagem" sem saber.
          registros: frequencia.status === 'fulfilled' ? prepararRegistros(frequencia.value?.registros) : null,
          avisos: lista(avisos, 'avisos'),
          notas: lista(notas, 'notas'),
          observacoes: lista(observacoes, 'observacoes'),
          vistaEm,
        }];
      }));

      // Lista e cards entram juntos: sem isso o card aparecia por um instante
      // dizendo "nenhuma passagem" antes de os dados chegarem.
      setLidos(await avisosLidos(namespace));
      setPorFilho(Object.fromEntries(dados));
      setFilhos(alunos);
      setCacheEm(resposta?._offline ? resposta._cacheEm || null : null);
      setErro('');
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
  // Evento de aluno so conta se for de um dos filhos; aviso nao traz aluno e conta sempre.
  useRecarregarAoVivo(EVENTOS, carregar, (mensagem) => {
    const alunoId = mensagem?.dados?.alunoId;
    return !alunoId || filhos.some((filho) => filho.id === alunoId);
  });

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

  const primeiroNome = usuario?.nome?.trim().split(/\s+/)[0];
  const naoLidos = contarAvisosNaoLidos(Object.values(porFilho).map(({ avisos }) => avisos), lidos);

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
          <Ficha rotulo="Avisos" valor={carregado ? naoLidos : '–'} atraso={200} />
          <Ficha rotulo="Pendências" valor={pendentes.length} atraso={270} />
        </View>

        {/* Sem o "+ Adicionar" ao lado do titulo: adicionar filho fica so no botao
            central da barra (Samuel, 2026-09-27). */}
        <AparecerEm atraso={170} style={estilos.secaoLinha}>
          <Text style={estilos.secao}>Seus filhos</Text>
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
            <CartaoFilho
              key={filho.id}
              filho={filho}
              dados={porFilho[filho.id]}
              lidos={lidos}
              atraso={210 + indice * 70}
              onAbrir={() => abrirFilho(filho)}
            />
          ))
        )}
      </ScrollView>

      <View style={estilos.navegacao}>
        <BarraNavegacao
          itens={[
            { chave: 'filhos', rotulo: 'Filhos', icone: 'people', ativo: true },
            { chave: 'sincronizar', rotulo: 'Sincronizar', icone: 'sync', onPress: () => navigation.navigate('Sincronizacao') },
          ]}
          central={{ rotulo: 'Adicionar', icone: 'add', onPress: () => navigation.navigate('AdicionarFilho') }}
        />
      </View>
    </View>
  );
}

function CartaoFilho({ filho, dados, lidos, atraso, onAbrir }) {
  const { ultima, avisosPendentes, notaNova, observacaoNova } = resumoDoFilho({ ...dados, registros: dados?.registros || [], lidos });
  const passagemConhecida = dados?.registros != null;
  const tomPonto = ultima?.tipoExibicao === 'Chegada' ? estilos.pontoVerde : ultima?.tipoExibicao === 'Saída' ? estilos.pontoAzul : null;
  return (
    <AparecerEm atraso={atraso}>
      <PressaoAnimada style={estilos.cartao} onPress={onAbrir}>
        <View style={estilos.avatarFilho}>
          <Text style={estilos.avatarFilhoTexto}>{iniciais(filho.nome)}</Text>
        </View>
        <View style={estilos.filhoTexto}>
          <Text style={estilos.nome}>{filho.nome}</Text>
          <Text style={estilos.detalhe}>
            {[filho.turma_nome || 'Sem turma', filho.filial_nome].filter(Boolean).join(' · ')}
          </Text>
          {passagemConhecida ? (
            <View style={estilos.passagem}>
              <View style={[estilos.ponto, tomPonto]} />
              <Text style={estilos.passagemTexto}>
                {ultima
                  ? `${rotuloDaPassagem(ultima)} · ${formatarDataHora(ultima.data_hora)}`
                  : 'Nenhuma passagem nos últimos 7 dias'}
              </Text>
            </View>
          ) : null}
          {avisosPendentes || notaNova || observacaoNova ? (
            <View style={estilos.selos}>
              {avisosPendentes ? (
                <Text style={[estilos.selo, estilos.seloAviso]}>
                  {avisosPendentes === 1 ? '1 aviso pendente' : `${avisosPendentes} avisos pendentes`}
                </Text>
              ) : null}
              {notaNova ? <Text style={[estilos.selo, estilos.seloNovo]}>Nova nota</Text> : null}
              {observacaoNova ? <Text style={[estilos.selo, estilos.seloNovo]}>Nova observação</Text> : null}
            </View>
          ) : null}
        </View>
        <View style={estilos.seta}>
          <Text style={estilos.setaTexto}>›</Text>
        </View>
      </PressaoAnimada>
    </AparecerEm>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20, gap: 14 },
  metricas: { flexDirection: 'row', gap: 10 },
  secaoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  secao: { color: cores.inkSoft, fontSize: 13, fontWeight: '700' },
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
  passagem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.inkSoft },
  pontoVerde: { backgroundColor: cores.verde },
  pontoAzul: { backgroundColor: cores.azul },
  passagemTexto: { flexShrink: 1, color: cores.ink, fontSize: 12.5, fontWeight: '700' },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  selo: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: raio.pill, overflow: 'hidden', fontSize: 11.5, fontWeight: '800' },
  // Tons escuros: o azul e o verde puros nao passam de 4,5:1 sobre o fundo claro do selo.
  seloAviso: { backgroundColor: cores.azulSoft, color: cores.azulEscuro },
  seloNovo: { backgroundColor: cores.verdeSoft, color: cores.verdeEscuro },
  navegacao: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
