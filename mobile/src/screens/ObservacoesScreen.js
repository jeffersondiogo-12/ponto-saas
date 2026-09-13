import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { Aviso, BotaoGrande, Cabecalho, Cartao, FaixaOffline, SeletorTurma, useBarraDeStatusEscura } from '../components/Ui';
import { cores, raio, sombra } from '../theme';

export default function ObservacoesScreen({ navigation }) {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  useBarraDeStatusEscura();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [alunoId, setAlunoId] = useState('');
  const [historico, setHistorico] = useState([]);
  const [observacao, setObservacao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [offline, setOffline] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  function tratarErro(err) {
    if (err?.status === 401) return logout();
    setErro(err?.message || 'Não foi possível completar a ação.');
  }

  const carregarHistorico = useCallback(async (turmaAlvo, alvoAlunoId) => {
    try {
      const res = await api.historicoDoAluno(turmaAlvo.turma_id, alvoAlunoId, turmaAlvo.atribuicao_id);
      setHistorico(res.observacoes || []);
    } catch {
      setHistorico([]);
    }
  }, []);

  const selecionarTurma = useCallback(async (item) => {
    setTurma(item);
    setMensagem('');
    try {
      const res = await api.listarAlunosDaTurma(item.turma_id, item.atribuicao_id);
      const lista = [...(res.alunos || [])].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
      setAlunos(lista);
      const primeiro = lista[0]?.id || '';
      setAlunoId(primeiro);
      if (primeiro) await carregarHistorico(item, primeiro);
      else setHistorico([]);
    } catch (err) {
      tratarErro(err);
    }
  }, [carregarHistorico]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.listarMinhasTurmas();
        const lista = res.turmas || [];
        setTurmas(lista);
        setOffline(Boolean(res._offline));
        if (lista.length) await selecionarTurma(lista[0]);
      } catch (err) {
        tratarErro(err);
      } finally {
        setCarregando(false);
      }
    })();
  }, [selecionarTurma]);

  async function salvar() {
    if (!turma || !alunoId || !observacao.trim()) return Alert.alert('Observação', 'Selecione o aluno e escreva a observação.');
    setEnviando(true);
    try {
      const resultado = await api.criarObservacaoProfessor(turma.turma_id, { aluno_id: alunoId, atribuicao_id: turma.atribuicao_id, titulo: `Observação de ${turma.materia}`, texto: observacao.trim() });
      setObservacao('');
      setErro('');
      if (resultado._fila) setMensagem('Sem conexão: observação salva no aparelho e será enviada assim que a internet voltar.');
      else {
        setMensagem('Observação enviada ao responsável.');
        await carregarHistorico(turma, alunoId);
      }
    } catch (err) {
      tratarErro(err);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <View style={estilos.centro}><ActivityIndicator color={cores.azul} /></View>;

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { paddingTop: insets.top + 20 }]}>
      <Cabecalho rotulo="ACOMPANHAMENTO" titulo="Observações" subtitulo="Recados que chegam ao responsável do aluno." acao={navigation?.goBack ? <PressaoAnimada style={estilos.voltar} onPress={() => navigation.goBack()}><Text style={estilos.voltarTexto}>Voltar</Text></PressaoAnimada> : null} />
      <FaixaOffline visivel={offline} />
      <Aviso tipo="erro" texto={erro} />
      <Aviso tipo="ok" texto={mensagem} />
      <SeletorTurma turmas={turmas} turmaAtiva={turma} aoSelecionar={selecionarTurma} />
      <Text style={estilos.secao}>Aluno</Text>
      <View style={estilos.opcoes}>{alunos.map((aluno) => { const ativo = aluno.id === alunoId; return <PressaoAnimada key={aluno.id} style={[estilos.opcao, ativo && estilos.opcaoAtiva]} escala={0.96} onPress={async () => { setAlunoId(aluno.id); if (turma) await carregarHistorico(turma, aluno.id); }}><Text style={[estilos.opcaoTexto, ativo && estilos.opcaoTextoAtivo]}>{aluno.nome}</Text></PressaoAnimada>; })}</View>
      <Cartao><TextInput style={estilos.area} placeholder="Escreva a observação..." placeholderTextColor={cores.inkSoft} value={observacao} onChangeText={setObservacao} multiline /><BotaoGrande texto={enviando ? 'Enviando...' : 'Enviar observação'} onPress={salvar} desabilitado={enviando} /></Cartao>
      <Text style={estilos.secao}>Últimas observações</Text>
      {historico.length === 0 ? <Text style={estilos.vazio}>Nenhuma observação registrada ainda.</Text> : historico.map((item, indice) => <AparecerEm key={item.id || indice} atraso={indice * 50} deslocamento={8}><View style={estilos.cartaoHistorico}><Text style={estilos.historicoTitulo}>{item.titulo || 'Observação'}</Text><Text style={estilos.historicoTexto}>{item.texto}</Text></View></AparecerEm>)}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper }, conteudo: { padding: 20, paddingBottom: 40, gap: 12 }, centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.paper }, secao: { fontSize: 13, fontWeight: '700', color: cores.inkSoft, marginTop: 6, marginBottom: 6 }, opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, opcao: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: raio.md, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.surfaceAlt }, opcaoAtiva: { borderColor: cores.azul, backgroundColor: cores.azulSoft }, opcaoTexto: { fontSize: 12, color: cores.inkSoft, fontWeight: '600' }, opcaoTextoAtivo: { color: cores.azul, fontWeight: '800' }, area: { minHeight: 110, textAlignVertical: 'top', borderWidth: 1, borderColor: cores.linha, borderRadius: raio.md, padding: 12, backgroundColor: cores.surfaceAlt, color: cores.ink, marginBottom: 12 }, cartaoHistorico: { padding: 14, borderRadius: raio.lg, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.surface, marginBottom: 10, ...sombra.cartao }, historicoTitulo: { fontWeight: '800', color: cores.ink }, historicoTexto: { fontSize: 13, color: cores.inkSoft, marginTop: 4 }, voltar: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.md, borderWidth: 1, borderColor: cores.linha }, voltarTexto: { color: cores.inkSoft, fontWeight: '700', fontSize: 12 }, vazio: { color: cores.inkSoft, textAlign: 'center', paddingVertical: 16 },
});
