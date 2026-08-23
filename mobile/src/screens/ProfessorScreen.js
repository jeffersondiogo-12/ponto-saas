import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme';

const hoje = new Date().toISOString().slice(0, 10);

export default function ProfessorScreen() {
  const { logout } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [alunoId, setAlunoId] = useState('');
  const [nota, setNota] = useState('');
  const [observacao, setObservacao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.listarMinhasTurmas().then((res) => {
      const lista = res.turmas || [];
      setTurmas(lista);
      if (lista[0]) selecionarTurma(lista[0]);
    }).catch((err) => setErro(err.message)).finally(() => setCarregando(false));
  }, []);

  async function selecionarTurma(item) {
    setTurma(item);
    try {
      const res = await api.listarAlunosDaTurma(item.turma_id);
      setAlunos(res.alunos || []);
      setAlunoId(res.alunos?.[0]?.id || '');
      setPresencas(Object.fromEntries((res.alunos || []).map((aluno) => [aluno.id, true])));
    } catch (err) { setErro(err.message); }
  }

  async function salvarPresencas() {
    try {
      await api.registrarPresencasSala(turma.turma_id, { data: hoje, presencas: alunos.map((aluno) => ({ aluno_id: aluno.id, presente: Boolean(presencas[aluno.id]) })) });
      setMensagem('Chamada registrada para a turma.');
    } catch (err) { setErro(err.message); }
  }

  async function salvarNota() {
    if (!alunoId || !nota) return Alert.alert('Nota', 'Selecione o aluno e informe a nota.');
    try {
      await api.criarNotaProfessor(turma.turma_id, { aluno_id: alunoId, disciplina: turma.materia, etapa: 'Atual', nota: Number(nota) });
      setNota(''); setMensagem('Nota enviada ao painel do aluno.');
    } catch (err) { setErro(err.message); }
  }

  async function salvarObservacao() {
    if (!alunoId || !observacao.trim()) return Alert.alert('Observação', 'Selecione o aluno e escreva a observação.');
    try {
      await api.criarObservacaoProfessor(turma.turma_id, { aluno_id: alunoId, titulo: `Observação de ${turma.materia}`, texto: observacao.trim() });
      setObservacao(''); setMensagem('Observação enviada ao responsável.');
    } catch (err) { setErro(err.message); }
  }

  if (carregando) return <View style={estilos.carregando}><ActivityIndicator color={cores.brass} /></View>;

  return <ScrollView style={estilos.container} contentContainerStyle={estilos.conteudo}>
    <View style={estilos.topo}><View><Text style={estilos.titulo}>Área do professor</Text><Text style={estilos.subtitulo}>Chamada e acompanhamento</Text></View><TouchableOpacity onPress={logout}><Text style={estilos.sair}>Sair</Text></TouchableOpacity></View>
    {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    {mensagem ? <Text style={estilos.sucesso}>{mensagem}</Text> : null}
    {turmas.length === 0 ? <Text style={estilos.vazio}>Nenhuma turma foi atribuída pelo gestor.</Text> : <>
      <Text style={estilos.rotulo}>Minhas turmas</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.turmas}>{turmas.map((item) => <TouchableOpacity key={item.atribuicao_id} style={[estilos.turma, turma?.atribuicao_id === item.atribuicao_id && estilos.turmaAtiva]} onPress={() => selecionarTurma(item)}><Text style={estilos.turmaNome}>{item.nome}</Text><Text>{item.materia} · {item.hora_inicio} - {item.hora_fim}</Text></TouchableOpacity>)}</ScrollView>
      {turma && <>
        <Text style={estilos.secao}>Presença em sala · {hoje}</Text>
        <View style={estilos.card}>{alunos.map((aluno) => <TouchableOpacity key={aluno.id} style={estilos.alunoLinha} onPress={() => setPresencas({ ...presencas, [aluno.id]: !presencas[aluno.id] })}><Text style={estilos.alunoNome}>{aluno.nome}</Text><Text style={presencas[aluno.id] ? estilos.presente : estilos.falta}>{presencas[aluno.id] ? 'Presente' : 'Ausente'}</Text></TouchableOpacity>)}<TouchableOpacity style={estilos.botao} onPress={salvarPresencas}><Text style={estilos.botaoTexto}>Salvar chamada</Text></TouchableOpacity></View>
        <Text style={estilos.secao}>Lançar nota ou observação</Text>
        <View style={estilos.card}><Text style={estilos.rotulo}>Aluno</Text><ScrollView horizontal>{alunos.map((aluno) => <TouchableOpacity key={aluno.id} style={[estilos.alunoChip, aluno.id === alunoId && estilos.alunoChipAtivo]} onPress={() => setAlunoId(aluno.id)}><Text>{aluno.nome}</Text></TouchableOpacity>)}</ScrollView><TextInput style={estilos.input} placeholder="Nota de 0 a 10" keyboardType="decimal-pad" value={nota} onChangeText={setNota} /><TouchableOpacity style={estilos.botao} onPress={salvarNota}><Text style={estilos.botaoTexto}>Enviar nota</Text></TouchableOpacity><TextInput style={[estilos.input, estilos.multilinha]} placeholder="Observação para o responsável" multiline value={observacao} onChangeText={setObservacao} /><TouchableOpacity style={estilos.botaoSecundario} onPress={salvarObservacao}><Text style={estilos.botaoSecundarioTexto}>Enviar observação</Text></TouchableOpacity></View>
      </>}
    </>}
  </ScrollView>;
}

const estilos = StyleSheet.create({
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.paper },
  container: { flex: 1, backgroundColor: cores.paper }, conteudo: { padding: 20, paddingTop: 58, paddingBottom: 40 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, titulo: { fontSize: 23, fontWeight: '700', color: cores.ink }, subtitulo: { color: cores.inkSoft, marginTop: 4 }, sair: { color: cores.inkSoft, textDecorationLine: 'underline' },
  rotulo: { color: cores.inkSoft, fontSize: 13, fontWeight: '600', marginBottom: 8 }, turmas: { marginBottom: 12 }, turma: { backgroundColor: cores.surface, borderRadius: 10, padding: 12, marginRight: 8, borderWidth: 1, borderColor: cores.linha }, turmaAtiva: { borderColor: cores.brass, backgroundColor: cores.brassSoft }, turmaNome: { fontWeight: '700', color: cores.ink, marginBottom: 4 }, secao: { color: cores.ink, fontSize: 17, fontWeight: '700', marginTop: 14, marginBottom: 8 }, card: { backgroundColor: cores.surface, borderRadius: 12, padding: 14 }, alunoLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: cores.linha }, alunoNome: { color: cores.ink, flex: 1 }, presente: { color: cores.sinalVerde, fontWeight: '700' }, falta: { color: cores.sinalVermelho, fontWeight: '700' }, alunoChip: { borderWidth: 1, borderColor: cores.linha, borderRadius: 8, padding: 9, marginRight: 6, marginBottom: 12 }, alunoChipAtivo: { borderColor: cores.brass, backgroundColor: cores.brassSoft }, input: { borderWidth: 1, borderColor: cores.linha, borderRadius: 9, padding: 12, marginBottom: 10, backgroundColor: cores.paper }, multilinha: { minHeight: 80, textAlignVertical: 'top' }, botao: { backgroundColor: cores.ink, padding: 14, borderRadius: 9, alignItems: 'center', marginTop: 4 }, botaoTexto: { color: '#fff', fontWeight: '700' }, botaoSecundario: { borderWidth: 1, borderColor: cores.brass, padding: 13, borderRadius: 9, alignItems: 'center' }, botaoSecundarioTexto: { color: cores.brass, fontWeight: '700' }, erro: { color: cores.sinalVermelho, marginVertical: 12 }, sucesso: { color: cores.sinalVerde, marginVertical: 12 }, vazio: { color: cores.inkSoft, marginTop: 35, textAlign: 'center' },
});
