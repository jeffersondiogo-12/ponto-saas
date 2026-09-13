import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, sombra } from '../theme';

/**
 * Barra de navegacao inferior do app — a mesma para professor e responsavel.
 *
 * itens:   [{ chave, rotulo, icone, ativo, desabilitado, onPress }]
 *          `icone` e o nome base do Ionicons: ativo usa o desenho cheio,
 *          inativo usa a versao "-outline".
 * central: { rotulo, icone, ativo, onPress } — acao principal em destaque,
 *          posicionada no meio dos itens.
 *
 * Ja reserva o espaco da barra de navegacao do Android (area segura).
 */
export default function BarraNavegacao({ itens, central }) {
  const insets = useSafeAreaInsets();
  const meio = Math.ceil(itens.length / 2);

  return (
    <View style={[estilos.barra, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {itens.slice(0, meio).map((item) => <Item key={item.chave} {...item} />)}
      {central ? <Central {...central} /> : null}
      {itens.slice(meio).map((item) => <Item key={item.chave} {...item} />)}
    </View>
  );
}

function Item({ rotulo, icone, ativo, desabilitado, onPress }) {
  const cor = ativo ? cores.azul : cores.inkSoft;
  return (
    <Pressable
      style={({ pressed }) => [estilos.item, desabilitado && estilos.desabilitado, pressed && !desabilitado && estilos.pressionado]}
      onPress={desabilitado ? undefined : onPress}
      disabled={desabilitado}
      accessibilityRole="tab"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: Boolean(ativo), disabled: Boolean(desabilitado) }}
    >
      <Ionicons name={ativo ? icone : `${icone}-outline`} size={24} color={cor} />
      <Text
        style={[estilos.rotulo, { color: cor }, ativo && estilos.rotuloAtivo]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

function Central({ rotulo, icone, ativo, onPress }) {
  return (
    <Pressable
      style={estilos.item}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: Boolean(ativo) }}
    >
      {({ pressed }) => (
        <>
          <View style={[estilos.circulo, pressed && estilos.pressionado]}>
            <Ionicons name={icone} size={28} color={cores.claro} />
          </View>
          <Text style={[estilos.rotulo, estilos.rotuloCentral]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {rotulo}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 6,
    paddingHorizontal: 4,
    backgroundColor: cores.surface,
    borderTopWidth: 1,
    borderTopColor: cores.linha,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3, minHeight: 52, paddingBottom: 2 },
  rotulo: { fontSize: 12, fontWeight: '600', color: cores.inkSoft },
  rotuloAtivo: { fontWeight: '800' },
  rotuloCentral: { color: cores.azul, fontWeight: '800' },
  desabilitado: { opacity: 0.4 },
  pressionado: { opacity: 0.6 },
  circulo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.azul,
    borderWidth: 4,
    borderColor: cores.surface,
    ...sombra.destaque,
  },
});
