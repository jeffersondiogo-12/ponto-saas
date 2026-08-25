import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../api';
import { cores } from '../theme';

export default function AdicionarFilhoScreen({ navigation }) {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [matricula, setMatricula] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function adicionar() {
    setErro(null);
    setCarregando(true);
    try {
      const resultado = await api.vincularFilho({
        nome_completo: nome.trim(),
        cpf,
        matricula_aluno: matricula.trim(),
        parentesco: parentesco.trim() || null,
      });
      if (resultado._fila) {
        Alert.alert(
          'Salvo no aparelho',
          'Sem conexão agora — assim que a internet voltar, o vínculo é confirmado automaticamente.',
          [{ text: 'Entendi', onPress: () => navigation.goBack() }]
        );
      } else {
        navigation.goBack();
      }
    } catch (err) {
      setErro(err.message || 'Não foi possível adicionar este aluno.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.container} keyboardShouldPersistTaps="handled">
      <Text style={estilos.titulo}>Confirme os dados do aluno</Text>
      <Text style={estilos.explicacao}>
        Use exatamente os dados cadastrados pela escola. Eles serão conferidos antes de liberar o acesso.
      </Text>
      {erro && <Text style={estilos.erro}>{erro}</Text>}
      <TextInput style={estilos.input} placeholder="Nome completo" value={nome} onChangeText={setNome} />
      <TextInput style={estilos.input} placeholder="CPF" keyboardType="numeric" value={cpf} onChangeText={setCpf} />
      <TextInput style={estilos.input} placeholder="Matrícula" value={matricula} onChangeText={setMatricula} />
      <TextInput style={estilos.input} placeholder="Parentesco (opcional)" value={parentesco} onChangeText={setParentesco} />
      <TouchableOpacity style={estilos.botao} onPress={adicionar} disabled={carregando}>
        {carregando ? <ActivityIndicator color="#eeb7b7" /> : <Text style={estilos.botaoTexto}>Adicionar filho</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: cores.paper, padding: 20 },
  titulo: { fontSize: 22, fontWeight: '700', color: cores.ink, marginBottom: 8 },
  explicacao: { color: cores.inkSoft, lineHeight: 20, marginBottom: 22 },
  input: { backgroundColor: cores.surface, borderWidth: 1, borderColor: cores.linha, borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 15 },
  botao: { backgroundColor: cores.ink, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
  botaoTexto: { color: '#fff', fontWeight: '700' },
  erro: { color: cores.sinalVermelho, backgroundColor: cores.sinalVermelhoSoft, padding: 12, borderRadius: 8, marginBottom: 14 },
});
