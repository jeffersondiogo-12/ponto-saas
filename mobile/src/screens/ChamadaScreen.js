import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { Aviso, BotaoGrande, Cabecalho, Cartao, FaixaOffline, SeletorTurma, useBarraDeStatusEscura } from '../components/Ui';
import { cores, raio, sombra } from '../theme';

const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const ESTADOS = {
  presente: { texto: 'Presente', fundo: 'verdeSoft', borda: 'verde', cor: 'verde' },
  justificada: { texto: 'Falta justificada', fundo: 'azulSoft', borda: 'azul', cor: 'azul' },
  ausente: { texto: 'Ausente', fundo: 'surfaceAlt', borda: 'linha', cor: 'inkSoft' },
};

function LinhaAluno({ aluno, estado, justificativa, onToggle, onJustificativa, onAbrir, atraso }) {
  const valor = useRef(new Animated.Value(estado === 'presente' ? 1 : 0)).current;
  const config = ESTADOS[estado];

  useEffect(() => {
    Animated.timing(valor, { toValue: estado === 'presente' ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [estado, valor]);

  return (
    <AparecerEm atraso={atraso} deslocamento={8}>
      <View style={estilos.alunoCartao}>
        <PressaoAnimada style={estilos.alunoLinha} onPress={onToggle} escala={0.985}>
          <View style={estilos.alunoTextos}>
            <Text style={estilos.alunoNome}>{aluno.nome}</Text>
            <Text style={estilos.alunoDetalhe}>
              {aluno.presenca_facial ? 'Chegou ao colégio' : 'Sem registro de entrada'}
            </Text>
          </View>
          <Animated.View
            style={[
              estilos.chave,
              {
                backgroundColor: valor.interpolate({ inputRange: [0, 1], outputRange: [cores[config.fundo], cores.verdeSoft] }),
                borderColor: valor.interpolate({ inputRange: [0, 1], outputRange: [cores[config.borda], cores.verde] }),
              },
            ]}
          >
            <Text style={[estilos.chaveTexto, { color: cores[config.cor] }]}>{config.texto}</Text>
          </Animated.View>
        </PressaoAnimada>
        {estado === 'justificada' ? (
          <TextInput
            style={estilos.justificativa}
            placeholder="Motivo da falta justificada"
            placeholderTextColor={cores.inkSoft}
            value={justificativa}
            onChangeText={onJustificativa}
          />
        ) : null}
        <PressaoAnimada style={estilos.verMais} onPress={onAbrir} escala={0.97}>
          <Text style={estilos.verMaisTexto}>Ver ficha do aluno</Text>
        </PressaoAnimada>
      </View>
    </AparecerEm>
  );
}

export default function ChamadaScreen({ navigation }) {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  useBarraDeStatusEscura();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [estados, setEstados] = useState({});
  const [justificativas, setJustificativas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [carregandoTurma, setCarregandoTurma] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [offline, setOffline] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  function tratarErro(err) {
    if (err?.status === 401) return logout();
    setErro(err?.message || 'Não foi possível completar a ação.');
  }

  const selecionarTurma = useCallback(async (item) => {
    setTurma(item);
    setCarregandoTurma(true);
    setMensagem('');
    try {
      const res = await api.listarAlunosDaTurma(item.turma_id, item.atribuicao_id);
      const lista = [...(res.alunos || [])].sort((a, b) =>
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' })
      );
      setAlunos(lista);
      setEstados(Object.fromEntries(lista.map((aluno) => [aluno.id, 'presente'])));
      setJustificativas({});
    } catch (err) {
      tratarErro(err);
    } finally {
      setCarregandoTurma(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarTurmas = useCallback(
    async (manterId) => {
      try {
        const res = await api.listarMinhasTurmas();
        const lista = res.turmas || [];
        setTurmas(lista);
        setOffline(Boolean(res._offline));
        setErro('');
        if (!lista.length) {
          setTurma(null);
          setAlunos([]);
          return;
        }
        const alvo = (manterId && lista.find((item) => item.atribuicao_id === manterId)) || lista[0];
        await selecionarTurma(alvo);
      } catch (err) {
        tratarErro(err);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [selecionarTurma]
  );

  useEffect(() => {
    carregarTurmas().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aoAtualizar() {
    setAtualizando(true);
    await carregarTurmas(turma?.atribuicao_id);
    setAtualizando(false);
  }

  function alternar(aluno) {
    const atual = estados[aluno.id] || 'ausente';
    const proximo = atual === 'presente' ? 'ausente' : atual === 'ausente' ? 'justificada' : 'presente';
    setEstados({ ...estados, [aluno.id]: proximo });
  }

  async function salvar() {
    if (!turma) return;
    setEnviando(true);
    try {
      const resultado = await api.registrarPresencasSala(turma.turma_id, {
        data: HOJE,
        atribuicao_id: turma.atribuicao_id,
        presencas: alunos.map((aluno) => ({
          aluno_id: aluno.id,
          presente: estados[aluno.id] === 'presente',
          falta_justificada: estados[aluno.id] === 'justificada',
          justificativa: justificativas[aluno.id] || '',
        })),
      });
      setErro('');
      setMensagem(
        resultado._fila
          ? 'Sem conexão: chamada salva no aparelho e será enviada assim que a internet voltar.'
          : 'Chamada registrada para a turma.'
      );
    } catch (err) {
      tratarErro(err);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cores.azul} />
      </View>
    );
  }

  const totalPresentes = alunos.filter((aluno) => estados[aluno.id] === 'presente').length;

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.conteudo, { paddingTop: insets.top + 20 }]}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={cores.azul} />}
    >
      <Cabecalho rotulo="PRESENÇA EM SALA" titulo="Chamada" subtitulo={`Toque para alternar entre presente, ausente e falta justificada · ${HOJE.split('-').reverse().join('/')}`} />
      <FaixaOffline visivel={offline} />
      <Aviso tipo="erro" texto={erro} />
      <Aviso tipo="ok" texto={mensagem} />

      <SeletorTurma turmas={turmas} turmaAtiva={turma} aoSelecionar={selecionarTurma} />

      {turmas.length === 0 ? (
        <Cartao>
          <Text style={estilos.vazio}>Nenhuma turma atribuída pelo gestor ainda.</Text>
        </Cartao>
      ) : carregandoTurma ? (
        <ActivityIndicator color={cores.azul} style={{ marginTop: 24 }} />
      ) : (
        <>
          <Cartao>
            <Text style={estilos.resumoTexto}>
              {totalPresentes} de {alunos.length} presentes
            </Text>
            <View style={estilos.barraFundo}>
              <View style={[estilos.barraProgresso, { width: `${alunos.length ? (totalPresentes / alunos.length) * 100 : 0}%` }]} />
            </View>
          </Cartao>

          {alunos.length === 0 ? (
            <Text style={estilos.vazio}>Nenhum aluno ativo nesta turma.</Text>
          ) : (
            alunos.map((aluno, indice) => (
              <LinhaAluno
                key={aluno.id}
                aluno={aluno}
                atraso={indice * 45}
                estado={estados[aluno.id] || 'ausente'}
                justificativa={justificativas[aluno.id] || ''}
                onToggle={() => alternar(aluno)}
                onJustificativa={(valor) => setJustificativas({ ...justificativas, [aluno.id]: valor })}
                onAbrir={() => navigation.navigate('AlunoDetalhe', { alunoId: aluno.id, nome: aluno.nome || 'Aluno' })}
              />
            ))
          )}

          <BotaoGrande
            texto={enviando ? 'Enviando...' : 'Salvar chamada'}
            onPress={salvar}
            desabilitado={enviando || alunos.length === 0}
          />
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20, paddingBottom: 40, gap: 14 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.paper },
  resumoTexto: { fontWeight: '800', color: cores.ink, marginBottom: 8 },
  barraFundo: { height: 8, borderRadius: 8, backgroundColor: cores.surfaceAlt, overflow: 'hidden' },
  barraProgresso: { height: 8, backgroundColor: cores.verde },
  alunoCartao: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: 12,
    marginBottom: 10,
    ...sombra.cartao,
  },
  alunoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alunoTextos: { flex: 1 },
  alunoNome: { fontWeight: '800', color: cores.ink },
  alunoDetalhe: { fontSize: 11, color: cores.inkSoft, marginTop: 2 },
  chave: { borderWidth: 1, borderRadius: raio.md, paddingHorizontal: 12, paddingVertical: 8 },
  chaveTexto: { fontSize: 11, fontWeight: '800' },
  justificativa: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: cores.surfaceAlt,
    color: cores.ink,
  },
  verMais: { marginTop: 10, alignSelf: 'flex-start' },
  verMaisTexto: { color: cores.azul, fontWeight: '700', fontSize: 12 },
  vazio: { color: cores.inkSoft, textAlign: 'center', paddingVertical: 20 },
});
