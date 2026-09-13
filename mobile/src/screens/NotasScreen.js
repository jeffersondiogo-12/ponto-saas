import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { Aviso, BotaoGrande, Cabecalho, Cartao, FaixaOffline, SeletorTurma, useBarraDeStatusEscura } from '../components/Ui';
import { cores, raio, sombra } from '../theme';

const BIMESTRES = ['1', '2', '3', '4'];
const TIPOS = [
  { chave: 'atividade', rotulo: 'Atividade' },
  { chave: 'prova', rotulo: 'Prova' },
  { chave: 'trabalho', rotulo: 'Trabalho' },
];

function Opcoes({ itens, valor, aoEscolher }) {
  return (
    <View style={estilos.opcoes}>
      {itens.map((item) => {
        const chave = item.chave ?? item;
        const rotulo = item.rotulo ?? item;
        const ativo = chave === valor;
        return (
          <PressaoAnimada key={chave} style={[estilos.opcao, ativo && estilos.opcaoAtiva]} onPress={() => aoEscolher(chave)} escala={0.96}>
            <Text style={[estilos.opcaoTexto, ativo && estilos.opcaoTextoAtivo]}>{rotulo}</Text>
          </PressaoAnimada>
        );
      })}
    </View>
  );
}

export default function NotasScreen({ navigation }) {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  useBarraDeStatusEscura();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [alunoId, setAlunoId] = useState('');
  const [historico, setHistorico] = useState([]);
  const [bimestre, setBimestre] = useState('1');
  const [tipoAvaliacao, setTipoAvaliacao] = useState('atividade');
  const [atividade, setAtividade] = useState('');
  const [nota, setNota] = useState('');
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
      setHistorico(res.notas || []);
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
    if (!turma || !alunoId) return Alert.alert('Nota', 'Selecione a turma e o aluno.');
    const valor = Number(String(nota).replace(',', '.'));
    if (!nota || Number.isNaN(valor) || valor < 0 || valor > 10 || !atividade.trim()) {
      return Alert.alert('Nota', 'Informe bimestre, atividade e uma nota válida entre 0 e 10.');
    }
    setEnviando(true);
    try {
      const resultado = await api.criarNotaProfessor(turma.turma_id, { aluno_id: alunoId, atribuicao_id: turma.atribuicao_id, disciplina: turma.materia, bimestre: Number(bimestre), tipo_avaliacao: tipoAvaliacao, atividade: atividade.trim(), nota: valor });
      setNota('');
      setAtividade('');
      setErro('');
      if (resultado._fila) setMensagem('Sem conexão: nota salva no aparelho e será enviada assim que a internet voltar.');
      else {
        setMensagem('Nota enviada ao painel do aluno.');
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
      <Cabecalho rotulo="AVALIAÇÕES" titulo="Notas" subtitulo="Lance uma nota por aluno e acompanhe o histórico." acao={navigation?.goBack ? <PressaoAnimada style={estilos.voltar} onPress={() => navigation.goBack()}><Text style={estilos.voltarTexto}>Voltar</Text></PressaoAnimada> : null} />
      <FaixaOffline visivel={offline} />
      <Aviso tipo="erro" texto={erro} />
      <Aviso tipo="ok" texto={mensagem} />
      <SeletorTurma turmas={turmas} turmaAtiva={turma} aoSelecionar={selecionarTurma} />
      <Text style={estilos.secao}>Aluno</Text>
      <Opcoes itens={alunos.map((aluno) => ({ chave: aluno.id, rotulo: aluno.nome }))} valor={alunoId} aoEscolher={async (id) => { setAlunoId(id); if (turma) await carregarHistorico(turma, id); }} />
      <Cartao>
        <Text style={estilos.secao}>Bimestre</Text>
        <Opcoes itens={BIMESTRES} valor={bimestre} aoEscolher={setBimestre} />
        <Text style={estilos.secao}>Tipo</Text>
        <Opcoes itens={TIPOS} valor={tipoAvaliacao} aoEscolher={setTipoAvaliacao} />
        <TextInput style={estilos.input} placeholder="Atividade (ex.: Prova de frações)" placeholderTextColor={cores.inkSoft} value={atividade} onChangeText={setAtividade} />
        <TextInput style={estilos.input} placeholder="Nota de 0 a 10" placeholderTextColor={cores.inkSoft} keyboardType="decimal-pad" value={nota} onChangeText={setNota} />
        <BotaoGrande texto={enviando ? 'Enviando...' : 'Salvar nota'} onPress={salvar} desabilitado={enviando} />
      </Cartao>
      <Text style={estilos.secao}>Histórico do aluno</Text>
      {historico.length === 0 ? <Text style={estilos.vazio}>Nenhuma nota lançada ainda.</Text> : historico.map((item, indice) => <AparecerEm key={item.id || indice} atraso={indice * 50} deslocamento={8}><View style={estilos.linhaHistorico}><View style={{ flex: 1 }}><Text style={estilos.historicoTitulo}>{item.atividade || item.disciplina}</Text><Text style={estilos.historicoDetalhe}>{item.bimestre ? `${item.bimestre}º bimestre` : ''} {item.tipo_avaliacao ? `· ${item.tipo_avaliacao}` : ''}</Text></View><Text style={estilos.historicoNota}>{item.nota}</Text></View></AparecerEm>)}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper }, conteudo: { padding: 20, paddingBottom: 40, gap: 12 }, centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.paper }, secao: { fontSize: 13, fontWeight: '700', color: cores.inkSoft, marginTop: 6, marginBottom: 6 }, opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, opcao: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: raio.md, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.surfaceAlt }, opcaoAtiva: { borderColor: cores.azul, backgroundColor: cores.azulSoft }, opcaoTexto: { fontSize: 12, color: cores.inkSoft, fontWeight: '600' }, opcaoTextoAtivo: { color: cores.azul, fontWeight: '800' }, input: { marginTop: 10, borderWidth: 1, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: cores.surfaceAlt, color: cores.ink, marginBottom: 6 }, linhaHistorico: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: raio.lg, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.surface, marginBottom: 10, ...sombra.cartao }, historicoTitulo: { fontWeight: '800', color: cores.ink }, historicoDetalhe: { fontSize: 11, color: cores.inkSoft, marginTop: 2 }, historicoNota: { fontSize: 20, fontWeight: '800', color: cores.azul }, voltar: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.md, borderWidth: 1, borderColor: cores.linha }, voltarTexto: { color: cores.inkSoft, fontWeight: '700', fontSize: 12 }, vazio: { color: cores.inkSoft, textAlign: 'center', paddingVertical: 16 },
});
