// Alerta que diferencia o tipo da obra no canto inferior do cartão:
// OBRA GERAL (cadastro por planilhas/arquivos) x PATOLOGIA DAS CONSTRUÇÕES (vistoria por fotos).
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fonts } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

export default function KindAlert({ kind, inline }: { kind?: string; inline?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const pato = kind === "patologia";
  const fg = pato ? "#1F1300" : colors.info;
  return (
    <View
      style={[
        styles.alert,
        inline ? styles.inline : styles.corner,
        pato ? { backgroundColor: colors.warning, borderColor: colors.borderStrong } : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
      ]}
      accessibilityLabel={pato ? "Trabalho de patologia das construções" : "Obra geral"}
    >
      <Ionicons name={pato ? "warning" : "business"} size={12} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{pato ? "PATOLOGIA DAS CONSTRUÇÕES" : "OBRA GERAL"}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  alert: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 2, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  // encostado no canto inferior direito do cartão (que tem padding spacing.md)
  corner: { alignSelf: "flex-end", marginTop: spacing.xs, marginRight: -spacing.md, marginBottom: -spacing.md },
  inline: { alignSelf: "flex-start" },
  text: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, fontWeight: "700", letterSpacing: 0.8 },
}));
