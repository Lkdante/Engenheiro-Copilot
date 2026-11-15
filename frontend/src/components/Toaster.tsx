// Notificações flutuantes do app (toasts).
// Visual: borda laranja (cor primária) e fundo igual ao fundo do tema em uso (claro ou escuro).
// Responsivo: no celular ocupa a largura da tela (com margem) no topo; em telas largas
// (tablet / navegador) fica no canto superior direito com largura fixa.
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "@/src/settings";
import { fonts, spacing } from "@/src/theme";
import { subscribeNotices, type Notice } from "@/src/notify";

const MAX_VISIBLE = 3;
const WIDE = 720;
const nativeDriver = Platform.OS !== "web";

export function Toaster() {
  const [items, setItems] = useState<Notice[]>([]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;

  useEffect(() => subscribeNotices((n) => {
    setItems((prev) => {
      const rest = n.key ? prev.filter((p) => p.key !== n.key) : prev;
      return [...rest, n].slice(-MAX_VISIBLE);
    });
  }), []);

  const remove = (id: number) => setItems((prev) => prev.filter((p) => p.id !== id));

  if (!items.length) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + spacing.sm,
        left: wide ? undefined : spacing.lg,
        right: wide ? spacing.xl : spacing.lg,
        width: wide ? 380 : undefined,
        gap: spacing.sm,
        zIndex: 1000,
        elevation: 1000,
      }}
    >
      {items.map((n) => <Toast key={n.id} notice={n} onDone={() => remove(n.id)} />)}
    </View>
  );
}

function Toast({ notice, onDone }: { notice: Notice; onDone: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: nativeDriver }).start(onDone);
  };

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: nativeDriver, friction: 8, tension: 80 }).start();
    const t = setTimeout(close, notice.duration ?? 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const icon = notice.kind === "error" ? "alert-circle" : notice.kind === "info" ? "information-circle" : "checkmark-circle";
  const iconColor = notice.kind === "error" ? colors.error : colors.brand;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }}
    >
      <Pressable
        onPress={close}
        accessibilityRole="alert"
        accessibilityLabel={`${notice.title}${notice.message ? `. ${notice.message}` : ""}`}
        accessibilityHint="Toque para fechar"
        style={styles.box}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={2}>{notice.title}</Text>
          {notice.message ? <Text style={styles.message} numberOfLines={notice.kind === "success" ? 2 : 6}>{notice.message}</Text> : null}
        </View>
        <Ionicons name="close" size={16} color={colors.info} />
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, // fundo do tema em uso
    borderWidth: 2,
    borderColor: colors.brand, // borda laranja
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: fontSize.base, fontWeight: "900", color: colors.onSurface },
  message: { fontFamily: fonts.display, fontSize: fontSize.sm, color: colors.info },
}));
