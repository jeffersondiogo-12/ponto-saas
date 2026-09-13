import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarStyle } from 'expo-status-bar';
import { AparecerEm, PressaoAnimada, Pulsar } from './Animacoes';
import { cores, raio, sombra } from '../theme';

/**
 * O padrao do app e barra de status clara (icones brancos), que some sobre
 * as telas de fundo claro. Telas claras chamam este hook: enquanto estao em
 * foco os icones ficam escuros; ao sair ou desmontar, voltam ao padrao.
 */
export function useBarraDeStatusEscura() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('dark');
      return () => setStatusBarStyle('light');
    }, [])
  );
}

/** Cabecalho padrao do "Hub de fichas". */
export function Cabecalho({ rotulo, titulo, subtitulo, acao }) {
  return (
    <AparecerEm style={estilos.topo}>
      <View style={estilos.topoTextos}>
        <Text style={estilos.rotulo}>{rotulo}</Text>
        <Text style={estilos.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
      </View>
      {acao ? <View>{acao}</View> : null}
    </AparecerEm>
  );
}

export function FaixaOffline({ visivel, texto }) {
  if (!visivel) return null;
  return (
    <Pulsar style={estilos.faixaOffline}>
      <Text style={estilos.faixaOfflineTexto}>{texto || 'Sem conexão — mostrando os dados salvos no aparelho.'}</Text>
    </Pulsar>
  );
}

export function FaixaPendente({ quantidade, onPress }) {
  if (!quantidade) return null;
  return (
    <PressaoAnimada style={estilos.faixaPendente} onPress={onPress}>
      <Text style={estilos.faixaPendenteTexto}>
        {quantidade === 1
          ? '1 ação aguardando conexão. Toque para sincronizar.'
          : `${quantidade} ações aguardando conexão. Toque para sincronizar.`}
      </Text>
    </PressaoAnimada>
  );
}

export function Aviso({ tipo, texto }) {
  if (!texto) return null;
  const erro = tipo === 'erro';
  return (
    <AparecerEm deslocamento={8} style={erro ? estilos.aviso : [estilos.aviso, estilos.avisoOk]}>
      <Text style={erro ? estilos.avisoTexto : [estilos.avisoTexto, estilos.avisoTextoOk]}>{texto}</Text>
    </AparecerEm>
  );
}

/** Ficha compacta de numero (usada no dashboard). */
export function Ficha({ rotulo, valor, destaque, atraso = 0, onPress }) {
  return (
    <AparecerEm atraso={atraso} deslocamento={10} style={estilos.fichaEnvolucro}>
      <PressaoAnimada style={[estilos.ficha, destaque && estilos.fichaDestaque]} onPress={onPress} escala={0.97}>
        <Text style={[estilos.fichaValor, destaque && estilos.fichaValorDestaque]}>{valor}</Text>
        <Text style={[estilos.fichaRotulo, destaque && estilos.fichaRotuloDestaque]}>{rotulo}</Text>
      </PressaoAnimada>
    </AparecerEm>
  );
}

export function BotaoGrande({ texto, onPress, secundario, desabilitado }) {
  return (
    <PressaoAnimada
      style={[estilos.botao, secundario && estilos.botaoSecundario, desabilitado && estilos.botaoDesativado]}
      onPress={desabilitado ? undefined : onPress}
    >
      <Text style={[estilos.botaoTexto, secundario && estilos.botaoTextoSecundario]}>{texto}</Text>
    </PressaoAnimada>
  );
}

/** Trilho horizontal de turmas, reutilizado em Chamada, Notas e Observacoes. */
export function SeletorTurma({ turmas, turmaAtiva, aoSelecionar }) {
  if (!turmas?.length) return null;
  return (
    <View>
      <Text style={estilos.secao}>Turma</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.trilho}>
        {turmas.map((item, indice) => {
          const ativa = turmaAtiva?.atribuicao_id === item.atribuicao_id;
          return (
            <AparecerEm key={item.atribuicao_id} atraso={indice * 60} deslocamento={10}>
              <PressaoAnimada
                style={[estilos.chip, ativa && estilos.chipAtivo]}
                onPress={() => aoSelecionar(item)}
                escala={0.97}
              >
                <Text style={[estilos.chipNome, ativa && estilos.chipNomeAtivo]}>{item.nome}</Text>
                <Text style={[estilos.chipDetalhe, ativa && estilos.chipDetalheAtivo]}>{item.materia}</Text>
              </PressaoAnimada>
            </AparecerEm>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Cartao({ children, style, atraso = 0 }) {
  return (
    <AparecerEm atraso={atraso} style={[estilos.cartao, style]}>
      {children}
    </AparecerEm>
  );
}

export const estilosBase = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20, paddingBottom: 40, gap: 16 },
  secao: { fontSize: 13, fontWeight: '700', color: cores.inkSoft, letterSpacing: 0.6, marginBottom: 8 },
  vazio: { color: cores.inkSoft, textAlign: 'center', paddingVertical: 24 },
});

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  topoTextos: { flex: 1 },
  rotulo: { fontSize: 11, letterSpacing: 1.4, fontWeight: '700', color: cores.azul },
  titulo: { fontSize: 26, fontWeight: '800', color: cores.ink, marginTop: 4 },
  subtitulo: { fontSize: 13, color: cores.inkSoft, marginTop: 4 },

  faixaOffline: {
    backgroundColor: cores.azulSoft,
    borderRadius: raio.md,
    padding: 12,
    borderWidth: 1,
    borderColor: cores.azul,
  },
  faixaOfflineTexto: { color: cores.azul, fontSize: 12, fontWeight: '600' },

  faixaPendente: {
    backgroundColor: cores.surfaceAlt,
    borderRadius: raio.md,
    padding: 12,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  faixaPendenteTexto: { color: cores.inkSoft, fontSize: 12, fontWeight: '600' },

  aviso: {
    backgroundColor: cores.surfaceAlt,
    borderRadius: raio.md,
    padding: 12,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  avisoOk: { backgroundColor: cores.verdeSoft, borderColor: cores.verde },
  avisoTexto: { fontSize: 12, fontWeight: '600', color: cores.inkSoft },
  avisoTextoOk: { color: cores.verde },

  fichaEnvolucro: { flex: 1 },
  ficha: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: 14,
    minHeight: 88,
    justifyContent: 'space-between',
    ...sombra.cartao,
  },
  fichaDestaque: { backgroundColor: cores.azulSoft, borderColor: cores.azul },
  fichaValor: { fontSize: 26, fontWeight: '800', color: cores.ink },
  fichaValorDestaque: { color: cores.azul },
  fichaRotulo: { fontSize: 11, color: cores.inkSoft, fontWeight: '600' },
  fichaRotuloDestaque: { color: cores.azul },

  botao: {
    backgroundColor: cores.azul,
    borderRadius: raio.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...sombra.destaque,
  },
  botaoSecundario: { backgroundColor: cores.surfaceAlt, borderWidth: 1, borderColor: cores.linha },
  botaoDesativado: { opacity: 0.5 },
  botaoTexto: { color: cores.claro, fontWeight: '800', fontSize: 15 },
  botaoTextoSecundario: { color: cores.azul },

  secao: { fontSize: 13, fontWeight: '700', color: cores.inkSoft, marginBottom: 8 },
  trilho: { gap: 10, paddingRight: 8 },
  chip: {
    backgroundColor: cores.surfaceAlt,
    borderRadius: raio.md,
    borderWidth: 1,
    borderColor: cores.linha,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 130,
  },
  chipAtivo: { backgroundColor: cores.azulSoft, borderColor: cores.azul },
  chipNome: { fontWeight: '800', color: cores.ink },
  chipNomeAtivo: { color: cores.azul },
  chipDetalhe: { fontSize: 11, color: cores.inkSoft, marginTop: 2 },
  chipDetalheAtivo: { color: cores.azul },

  cartao: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: 16,
    ...sombra.cartao,
  },
});
