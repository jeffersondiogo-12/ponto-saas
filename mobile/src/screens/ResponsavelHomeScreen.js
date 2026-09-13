import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, obterNamespaceCache } from '../api';
import { obterFila, ouvirFila } from '../filaOffline';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada, Pulsar } from '../components/Animacoes';
import BarraNavegacao from '../components/BarraNavegacao';
import { useBarraDeStatusEscura } from '../components/Ui';
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

function saudacao() {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date())
  );
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatarDataHora(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function textoPendencias(quantidade) {
  return quantidade === 1 ? '1 ação aguardando envio' : `${quantidade} ações aguardando envio`;
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
        <AparecerEm style={estilos.cabecalho}>
          <View style={estilos.marcaLinha}>
            <Image source={require('../../assets/app-icon.png')} style={estilos.logo} accessibilityLabel="Ponte Escolar" />
            <Text style={estilos.marca}>PONTE · ESCOLAR</Text>
          </View>
          <View style={estilos.contaLinha}>
            <View style={estilos.avatar}>
              <Text style={estilos.avatarTexto}>{iniciais(usuario?.nome) || '?'}</Text>
            </View>
            <PressaoAnimada style={estilos.sair} onPress={sair}>
              <Text style={estilos.sairTexto}>Sair</Text>
            </PressaoAnimada>
          </View>
        </AparecerEm>

        <AparecerEm atraso={50}>
          <Text style={estilos.rotulo}>RESPONSÁVEL</Text>
          <Text style={estilos.titulo}>{saudacao()}, {primeiroNome || 'família'}.</Text>
        </AparecerEm>

        {cacheEm || pendentes.length > 0 ? (
          <AparecerEm atraso={90}>
            <Pulsar style={estilos.faixa}>
              <View style={estilos.faixaLinha}>
                <View style={estilos.ponto} />
                <Text style={estilos.faixaTexto}>
                  {cacheEm ? `Sem conexão · dados de ${formatarDataHora(cacheEm)}` : textoPendencias(pendentes.length)}
                  {cacheEm && pendentes.length > 0 ? ` · ${textoPendencias(pendentes.length)}` : ''}
                </Text>
              </View>
              <PressaoAnimada onPress={() => navigation.navigate('Sincronizacao')}>
                <Text style={estilos.faixaAcao}>Sincronizar</Text>
              </PressaoAnimada>
            </Pulsar>
          </AparecerEm>
        ) : null}

        {erro && filhos.length > 0 ? (
          <View style={estilos.erroFaixa}>
            <Text style={estilos.erroTexto}>{erro}</Text>
          </View>
        ) : null}

        <AparecerEm atraso={130} style={estilos.metricas}>
          <Metrica rotulo="FILHOS" valor={carregado ? filhos.length : '–'} />
          <Metrica rotulo="AVISOS" valor={carregado ? avisos.length : '–'} azul />
          <Metrica rotulo="PENDÊNCIAS" valor={pendentes.length} />
        </AparecerEm>

        <AparecerEm atraso={170} style={estilos.secaoLinha}>
          <Text style={estilos.secao}>SEUS FILHOS</Text>
          <PressaoAnimada onPress={() => navigation.navigate('AdicionarFilho')}>
            <Text style={estilos.adicionar}>+ Adicionar</Text>
          </PressaoAnimada>
        </AparecerEm>

        {!carregado ? (
          <ActivityIndicator color={cores.azul} style={estilos.carregando} />
        ) : erro && filhos.length === 0 ? (
          <View style={estilos.estadoCartao}>
            <Text style={estilos.estadoTitulo}>Não deu para carregar</Text>
            <Text style={estilos.estadoTexto}>{erro}</Text>
            <PressaoAnimada style={estilos.estadoBotao} onPress={carregar}>
              <Text style={estilos.estadoBotaoTexto}>Tentar de novo</Text>
            </PressaoAnimada>
          </View>
        ) : filhos.length === 0 ? (
          <View style={estilos.estadoCartao}>
            <Text style={estilos.estadoTitulo}>Nenhum filho vinculado ainda</Text>
            <Text style={estilos.estadoTexto}>Adicione seu filho com a matrícula informada pela escola.</Text>
            <PressaoAnimada style={estilos.estadoBotao} onPress={() => navigation.navigate('AdicionarFilho')}>
              <Text style={estilos.estadoBotaoTexto}>Adicionar filho</Text>
            </PressaoAnimada>
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
            <PressaoAnimada onPress={() => abrirAvisos(ultimoAviso)}>
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

function Metrica({ rotulo, valor, azul }) {
  return (
    <View style={estilos.metrica}>
      <Text style={estilos.rotuloMetrica}>{rotulo}</Text>
      <Text style={[estilos.valorMetrica, azul && { color: cores.azul }]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#F4F0E6' },
  conteudo: { paddingHorizontal: 18 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  marcaLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28, borderRadius: 8 },
  marca: { color: cores.inkSoft, fontSize: 8, letterSpacing: 2.2, fontWeight: '700' },
  contaLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EAE7DD', alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: cores.ink, fontSize: 10, fontWeight: '800' },
  sair: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: raio.pill, borderWidth: 1, borderColor: '#E4E1D8', backgroundColor: cores.surface },
  sairTexto: { color: cores.inkSoft, fontSize: 11, fontWeight: '700' },
  rotulo: { color: cores.inkSoft, fontSize: 9, letterSpacing: 1.8, fontWeight: '700' },
  titulo: { color: cores.ink, fontSize: 22, fontWeight: '800', marginTop: 5 },
  faixa: { marginTop: 14, backgroundColor: '#E4ECFF', borderRadius: raio.md, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  faixaLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  ponto: { width: 5, height: 5, borderRadius: 3, backgroundColor: cores.azul },
  faixaTexto: { color: cores.azul, fontSize: 10, fontWeight: '700', flexShrink: 1 },
  faixaAcao: { color: cores.azul, fontSize: 10, fontWeight: '800' },
  erroFaixa: { marginTop: 12, backgroundColor: cores.vermelhoSoft, borderLeftWidth: 3, borderLeftColor: cores.vermelho, borderRadius: raio.sm, padding: 10 },
  erroTexto: { color: cores.vermelho, fontSize: 11, fontWeight: '600' },
  metricas: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metrica: { flex: 1, minHeight: 60, padding: 10, backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: '#E4E1D8' },
  rotuloMetrica: { color: cores.inkSoft, fontSize: 8, letterSpacing: 1.1, fontWeight: '700' },
  valorMetrica: { color: cores.ink, fontSize: 20, fontWeight: '800', marginTop: 5 },
  secaoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 },
  secao: { color: cores.inkSoft, fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  adicionar: { color: cores.azul, fontSize: 10, fontWeight: '800' },
  carregando: { marginVertical: 24 },
  estadoCartao: { backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: '#E4E1D8', padding: 16, marginBottom: 8, alignItems: 'center', ...sombra.cartao },
  estadoTitulo: { color: cores.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  estadoTexto: { color: cores.inkSoft, fontSize: 11, marginTop: 4, textAlign: 'center', lineHeight: 16 },
  estadoBotao: { marginTop: 12, backgroundColor: cores.azul, borderRadius: raio.pill, paddingHorizontal: 16, paddingVertical: 9 },
  estadoBotaoTexto: { color: cores.claro, fontSize: 11, fontWeight: '800' },
  cartao: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: '#E4E1D8', padding: 12, marginBottom: 8, ...sombra.cartao },
  avatarFilho: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: cores.azulSoft },
  avatarFilhoTexto: { fontSize: 12, fontWeight: '800', color: cores.azul },
  filhoTexto: { flex: 1 },
  nome: { color: cores.ink, fontSize: 13, fontWeight: '800' },
  detalhe: { color: cores.inkSoft, fontSize: 10, marginTop: 2 },
  seta: { width: 22, height: 22, borderRadius: 11, backgroundColor: cores.verdeSoft, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { color: cores.verde, fontSize: 16, fontWeight: '800', marginTop: -2 },
  aviso: { backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: '#E4E1D8', padding: 13, marginTop: 4, ...sombra.cartao },
  rotuloAviso: { color: cores.inkSoft, fontSize: 8, letterSpacing: 1.5, fontWeight: '700' },
  tituloAviso: { color: cores.ink, fontSize: 12, fontWeight: '800', marginTop: 5 },
  detalheAviso: { color: cores.inkSoft, fontSize: 10, marginTop: 3, lineHeight: 14 },
  verAvisos: { color: cores.azul, fontSize: 10, fontWeight: '800', marginTop: 11 },
  navegacao: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
