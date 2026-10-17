// Janela de confirmação no visual do app (substitui o Alert do sistema e o window.confirm do navegador).
// Mesmo padrão das notificações: borda laranja e fundo na cor do tema em uso.
// Responsiva: no celular ocupa a largura da tela (com margem); em telas largas fica centralizada com 440px.
// Uso:  if (await confirmDialog({ title, message, confirmText: "Sim, cancelar" })) { ... }
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "@/src/settings";
import { fonts, spacing } from "@/src/theme";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Ação que apaga/descarta algo: botão de confirmar em vermelho. */
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
let show: ((p: Pending) => void) | null = null;

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(false);
    show({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < 380;

  useEffect(() => {
    show = (next) => setP((cur) => { cur?.resolve(false); return next; });
    return () => { show = null; };
  }, []);

  const close = (ok: boolean) => { p?.resolve(ok); setP(null); };
  if (!p) return null;

  const danger = !!p.destructive;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(false)} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel="Fechar">
        <Pressable style={[styles.card, { width: Math.min(width - spacing.lg * 2, 440) }]} onPress={() => {}} accessibilityRole="alert">
          <View style={styles.head}>
            <Ionicons name={p.icon || (danger ? "warning" : "help-circle")} size={24} color={danger ? colors.error : colors.brand} />
            <Text style={styles.title}>{p.title}</Text>
          </View>
          {p.message ? <Text style={styles.message}>{p.message}</Text> : null}
          <View style={[styles.actions, narrow && { flexDirection: "column-reverse" }]}>
            <Pressable onPress={() => close(false)} style={({ pressed }) => [styles.btn, styles.btnGhost, narrow ? null : { flex: 1 }, pressed && styles.pressed]}>
              <Text style={styles.btnGhostText}>{(p.cancelText || "Voltar").toUpperCase()}</Text>
            </Pressable>
            <Pressable
              onPress={() => close(true)}
              style={({ pressed }) => [styles.btn, { backgroundColor: danger ? colors.error : colors.brand, borderColor: danger ? colors.error : colors.brand }, narrow ? null : { flex: 1 }, pressed && styles.pressed]}
            >
              <Text style={styles.btnText}>{(p.confirmText || "Confirmar").toUpperCase()}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: {
    backgroundColor: colors.surface, // fundo do tema em uso
    borderWidth: 2,
    borderColor: colors.brand, // borda laranja
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "900", color: colors.onSurface },
  message: { fontFamily: fonts.display, fontSize: fontSize.sm, color: colors.info, lineHeight: Math.round(fontSize.sm * 1.5) },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  btn: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderWidth: 2 },
  btnGhost: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  btnGhostText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface, letterSpacing: 1 },
  btnText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: "#FFFFFF", letterSpacing: 1 },
  pressed: { opacity: 0.8 },
}));
