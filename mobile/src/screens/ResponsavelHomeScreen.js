import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada, Pulsar } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

const exemplos = [
	{ nome: 'Marina Alves', turma: '3º B', status: 'Na escola', cor: cores.verde, fundo: cores.verdeSoft },
	{ nome: 'Theo Alves', turma: '5º A', status: 'Saiu às 17:05', cor: cores.azul, fundo: cores.azulSoft },
];

function iniciais(nome = '') {
	return nome.trim().split(/\s+/).map((parte) => parte[0]).slice(0, 2).join('');
}

export default function ResponsavelHomeScreen({ navigation }) {
	const [filhos, setFilhos] = useState(exemplos);
	const { usuario } = useAuth();

	useFocusEffect(useCallback(() => {
		let ativo = true;
		api.listarAlunos().then((resposta) => {
			if (!ativo || !resposta?.alunos?.length) return;
			setFilhos(resposta.alunos.map((aluno, indice) => ({
				...aluno,
				turma: aluno.turma_nome || 'Sem turma',
				status: indice === 0 ? 'Na escola' : 'Saiu às 17:05',
				cor: indice === 0 ? cores.verde : cores.azul,
				fundo: indice === 0 ? cores.verdeSoft : cores.azulSoft,
			})));
		}).catch(() => {});
		return () => { ativo = false; };
	}, []));

	return (
		<View style={estilos.tela}>
			<ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
				<AparecerEm style={estilos.cabecalho}>
					<View style={estilos.marcaLinha}><View style={estilos.logo}><Text style={estilos.logoTexto}>P</Text></View><Text style={estilos.marca}>PONTE · ESCOLAR</Text></View>
					<View style={estilos.avatar}><Text style={estilos.avatarTexto}>CS</Text></View>
				</AparecerEm>
				<AparecerEm atraso={50}><Text style={estilos.rotulo}>RESPONSÁVEL · SEG · 09:14</Text><Text style={estilos.titulo}>Bom dia, {usuario?.nome?.split(' ')[0] || 'família'}.</Text></AparecerEm>
				<AparecerEm atraso={90}>
					<Pulsar style={estilos.offline}><View style={estilos.offlineLinha}><View style={estilos.ponto} /><Text style={estilos.offlineTexto}>Offline · 3 pendências</Text></View><PressaoAnimada onPress={() => navigation.navigate('Sincronizacao')}><Text style={estilos.sincronizar}>Sincronizar</Text></PressaoAnimada></Pulsar>
				</AparecerEm>
				<AparecerEm atraso={130} style={estilos.metricas}><Metrica rotulo="FILHOS" valor={filhos.length} /><Metrica rotulo="NA ESCOLA" valor="1" verde /><Metrica rotulo="AVISOS" valor="3" azul /></AparecerEm>
				<AparecerEm atraso={170} style={estilos.secaoLinha}><Text style={estilos.secao}>SEUS FILHOS</Text><PressaoAnimada onPress={() => navigation.navigate('AdicionarFilho')}><Text style={estilos.adicionar}>+ Adicionar</Text></PressaoAnimada></AparecerEm>
				{filhos.map((filho, indice) => <AparecerEm key={filho.id || filho.nome} atraso={210 + indice * 70}><PressaoAnimada style={estilos.cartao} onPress={() => navigation.navigate('AlunoDetalhe', { alunoId: filho.id, nome: filho.nome })}><View style={[estilos.avatarFilho, { backgroundColor: filho.fundo }]}><Text style={[estilos.avatarFilhoTexto, { color: filho.cor }]}>{iniciais(filho.nome)}</Text></View><View style={estilos.filhoTexto}><Text style={estilos.nome}>{filho.nome}</Text><Text style={estilos.detalhe}>{filho.turma} · Unidade Centro</Text><View style={[estilos.status, { backgroundColor: filho.fundo }]}><Text style={[estilos.statusTexto, { color: filho.cor }]}>{filho.status}</Text></View></View><View style={estilos.seta}><Text style={estilos.setaTexto}>›</Text></View></PressaoAnimada></AparecerEm>)}
				<AparecerEm atraso={360} style={estilos.aviso}><Text style={estilos.rotuloAviso}>ÚLTIMO AVISO</Text><Text style={estilos.tituloAviso}>Reunião de pais</Text><Text style={estilos.detalheAviso}>Quinta às 19h no auditório.</Text><PressaoAnimada onPress={() => navigation.navigate('Relatorios')}><Text style={estilos.verAvisos}>Ver todos os avisos →</Text></PressaoAnimada></AparecerEm>
				<Text style={estilos.professor}>Entrar como professor →</Text>
			</ScrollView>
			<View style={estilos.navegacao}><ItemNav texto="Filhos" ativo /><ItemNav texto="Avisos" onPress={() => navigation.navigate('Relatorios')} /><PressaoAnimada style={estilos.acaoCentral} onPress={() => navigation.navigate('AdicionarFilho')}><Text style={estilos.mais}>+</Text></PressaoAnimada><ItemNav texto="Aluno" onPress={() => navigation.navigate('AlunoDetalhe', { alunoId: filhos[0]?.id, nome: filhos[0]?.nome })} /><ItemNav texto="Sincronizar" onPress={() => navigation.navigate('Sincronizacao')} /></View>
		</View>
	);
}

function Metrica({ rotulo, valor, verde, azul }) { return <View style={estilos.metrica}><Text style={estilos.rotuloMetrica}>{rotulo}</Text><Text style={[estilos.valorMetrica, verde && { color: cores.verde }, azul && { color: cores.azul }]}>{valor}</Text></View>; }
function ItemNav({ texto, ativo, onPress }) { return <PressaoAnimada style={estilos.itemNav} onPress={onPress}><View style={[estilos.iconeNav, ativo && estilos.iconeAtivo]} /><Text style={[estilos.textoNav, ativo && estilos.textoAtivo]}>{texto}</Text></PressaoAnimada>; }

const estilos = StyleSheet.create({
	tela: { flex: 1, backgroundColor: '#F4F0E6' }, conteudo: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 116 }, cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, marcaLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 }, logo: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.azul }, logoTexto: { color: cores.claro, fontSize: 15, fontWeight: '800' }, marca: { color: cores.inkSoft, fontSize: 8, letterSpacing: 2.2, fontWeight: '700' }, avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EAE7DD', alignItems: 'center', justifyContent: 'center' }, avatarTexto: { color: cores.ink, fontSize: 10, fontWeight: '800' }, rotulo: { color: cores.inkSoft, fontSize: 9, letterSpacing: 1.8, fontWeight: '700' }, titulo: { color: cores.ink, fontSize: 22, fontWeight: '800', marginTop: 5 }, offline: { marginTop: 14, backgroundColor: '#E4ECFF', borderRadius: raio.md, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, offlineLinha: { flexDirection: 'row', alignItems: 'center', gap: 6 }, ponto: { width: 5, height: 5, borderRadius: 3, backgroundColor: cores.azul }, offlineTexto: { color: cores.azul, fontSize: 10, fontWeight: '700' }, sincronizar: { color: cores.azul, fontSize: 9, fontWeight: '700' }, metricas: { flexDirection: 'row', gap: 8, marginTop: 12 }, metrica: { flex: 1, minHeight: 60, padding: 10, backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: '#E4E1D8' }, rotuloMetrica: { color: cores.inkSoft, fontSize: 8, letterSpacing: 1.1, fontWeight: '700' }, valorMetrica: { color: cores.ink, fontSize: 20, fontWeight: '800', marginTop: 5 }, secaoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 }, secao: { color: cores.inkSoft, fontSize: 9, letterSpacing: 1.5, fontWeight: '700' }, adicionar: { color: cores.azul, fontSize: 10, fontWeight: '800' }, cartao: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: '#E4E1D8', padding: 12, marginBottom: 8, ...sombra.cartao }, avatarFilho: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, avatarFilhoTexto: { fontSize: 12, fontWeight: '800' }, filhoTexto: { flex: 1 }, nome: { color: cores.ink, fontSize: 13, fontWeight: '800' }, detalhe: { color: cores.inkSoft, fontSize: 10, marginTop: 2 }, status: { alignSelf: 'flex-start', borderRadius: raio.pill, paddingHorizontal: 7, paddingVertical: 3, marginTop: 5 }, statusTexto: { fontSize: 8, fontWeight: '800' }, seta: { width: 22, height: 22, borderRadius: 11, backgroundColor: cores.verdeSoft, alignItems: 'center', justifyContent: 'center' }, setaTexto: { color: cores.verde, fontSize: 16, fontWeight: '800', marginTop: -2 }, aviso: { backgroundColor: cores.surface, borderRadius: raio.md, borderWidth: 1, borderColor: '#E4E1D8', padding: 13, marginTop: 4, ...sombra.cartao }, rotuloAviso: { color: cores.inkSoft, fontSize: 8, letterSpacing: 1.5, fontWeight: '700' }, tituloAviso: { color: cores.ink, fontSize: 12, fontWeight: '800', marginTop: 5 }, detalheAviso: { color: cores.inkSoft, fontSize: 10, marginTop: 3 }, verAvisos: { color: cores.azul, fontSize: 10, fontWeight: '800', marginTop: 11 }, professor: { color: cores.inkSoft, fontSize: 10, marginTop: 17 }, navegacao: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: cores.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#E4E1D8' }, itemNav: { width: 54, alignItems: 'center', justifyContent: 'center', gap: 4 }, iconeNav: { width: 8, height: 8, borderRadius: 2, backgroundColor: cores.inkSoft, opacity: 0.5 }, iconeAtivo: { backgroundColor: cores.azul, opacity: 1 }, textoNav: { color: cores.inkSoft, fontSize: 8, textAlign: 'center' }, textoAtivo: { color: cores.azul, fontWeight: '800' }, acaoCentral: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.azul, marginTop: -22, ...sombra.destaque }, mais: { color: cores.claro, fontSize: 25, fontWeight: '300', marginTop: -2 },
});