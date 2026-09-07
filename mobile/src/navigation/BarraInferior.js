import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressaoAnimada } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

import InicioScreen from '../screens/InicioScreen';
import AgendaScreen from '../screens/AgendaScreen';
import ChamadaScreen from '../screens/ChamadaScreen';
import RelatoriosScreen from '../screens/RelatoriosScreen';
import SincronizacaoScreen from '../screens/SincronizacaoScreen';

const ABAS = [
  { chave: 'inicio', rotulo: 'Início', icone: '⌂', Tela: InicioScreen },
  { chave: 'agenda', rotulo: 'Agenda', icone: '▤', Tela: AgendaScreen },
  { chave: 'chamada', rotulo: 'Chamada', icone: '✓', Tela: ChamadaScreen, central: true },
  { chave: 'relatorios', rotulo: 'Relatórios', icone: '◔', Tela: RelatoriosScreen },
  { chave: 'sincronizar', rotulo: 'Sincronizar', icone: '⟳', Tela: SincronizacaoScreen },
];

/**
 * Navegacao nova: barra inferior com botao central azul de acao (chamada).
 * Nao depende de bibliotecas extras — troca de tela por estado local e
 * repassa o `navigation` do stack para as telas empilhadas (AlunoDetalhe,
 * Notas, Observacoes...).
 */
export default function BarraInferior({ navigation, route }) {
  const [ativa, setAtiva] = useState(route?.params?.aba || 'inicio');
  const Atual = useMemo(() => ABAS.find((aba) => aba.chave === ativa)?.Tela || InicioScreen, [ativa]);

  const navegacao = useMemo(
    () => ({
      ...navigation,
      navigate: (destino, params) => {
        const aba = ABAS.find((item) => item.chave === String(destino).toLowerCase());
        if (aba) return setAtiva(aba.chave);
        return navigation.navigate(destino, params);
      },
      irParaAba: setAtiva,
    }),
    [navigation]
  );

  return (
    <View style={estilos.tela}>
      <View style={estilos.conteudo}>
        <Atual navigation={navegacao} />
      </View>

      <View style={estilos.barra}>
        {ABAS.map((aba) => {
          const selecionada = aba.chave === ativa;
          if (aba.central) {
            return (
              <PressaoAnimada key={aba.chave} style={estilos.central} onPress={() => setAtiva(aba.chave)} escala={0.94}>
                <Text style={estilos.centralIcone}>{aba.icone}</Text>
              </PressaoAnimada>
            );
          }
          return (
            <PressaoAnimada key={aba.chave} style={estilos.item} onPress={() => setAtiva(aba.chave)} escala={0.94}>
              <Text style={[estilos.icone, selecionada && estilos.iconeAtivo]}>{aba.icone}</Text>
              <Text style={[estilos.rotulo, selecionada && estilos.rotuloAtivo]}>{aba.rotulo}</Text>
            </PressaoAnimada>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { flex: 1 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 22,
    backgroundColor: cores.surface ?? cores.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: cores.linha,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  icone: { fontSize: 18, color: cores.inkSoft },
  iconeAtivo: { color: cores.azul },
  rotulo: { fontSize: 10, color: cores.inkSoft, fontWeight: '600' },
  rotuloAtivo: { color: cores.azul, fontWeight: '800' },
  central: {
    width: 58,
    height: 58,
    borderRadius: raio.xl ?? 29,
    backgroundColor: cores.azul,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    ...(sombra?.media || sombra?.leve || {}),
  },
  centralIcone: { color: cores.claro, fontSize: 24, fontWeight: '800' },
});
