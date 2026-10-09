import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, getStoredUser, clearAuth, getActiveObra } from "@/src/api";
import { spacing, fonts, fontSize } from "@/src/theme";
import { makeStyles, useTheme } from "@/src/settings";

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at?: string };

const QUICK = [
  "Quais inspeções tenho para fazer hoje?",
  "Existe alguma não conformidade crítica aberta?",
  "Gere um relatório do avanço da obra.",
  "Quais EPIs estão próximos do vencimento?",
];

export default function Copiloto() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [mode, setMode] = useState<"ai" | "local" | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sessionRef = useRef<string>(`sess-${Date.now()}`);
  const obraRef = useRef<string | null>(null);
  const [obraName, setObraName] = useState("");

  // Ao trocar de obra, começa uma conversa nova (o contexto do copiloto é da obra ativa)
  useFocusEffect(useCallback(() => {
    (async () => {
      const o = await getActiveObra();
      setObraName(o?.name || "");
      if (obraRef.current && o?.id !== obraRef.current) {
        setMessages([]);
        sessionRef.current = `sess-${Date.now()}`;
      }
      obraRef.current = o?.id || null;
    })();
  }, []));

  useEffect(() => { (async () => setUser(await getStoredUser()))(); }, []);

  const logout = async () => {
    await clearAuth();
    router.replace("/obras");
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const userMsg: Msg = { id: `${Date.now()}`, role: "user", content: msg };
    setMessages((p) => [...p, userMsg]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      const r = await api<{ message: string; id: string; mode?: "ai" | "local" }>("/copilot/chat", { method: "POST", body: { session_id: sessionRef.current, message: msg } });
      setMessages((p) => [...p, { id: r.id, role: "assistant", content: r.message }]);
      if (r.mode) setMode(r.mode);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (e: any) {
      setMessages((p) => [...p, { id: `err-${Date.now()}`, role: "assistant", content: `Erro: ${e?.message || e}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel} numberOfLines={1}>{obraName ? `COPILOTO • ${obraName.toUpperCase()}` : "COPILOTO IA"}</Text>
          <Text style={styles.hTitle}>Olá, {user?.name?.split(" ")[0] || "Engenheiro"}</Text>
        </View>
        <View style={styles.statusDot}>
          <View style={styles.dot} />
          <Text style={styles.hStatus}>{mode === "local" ? "MODO LOCAL" : "ATIVO"}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}>
        <ScrollView ref={scrollRef} style={styles.stream} contentContainerStyle={styles.streamContent} showsVerticalScrollIndicator={false}>
          {messages.length === 0 && (
            <View style={styles.emptyBlock}>
              <View style={styles.emptyBox}>
                <Ionicons name="construct" size={24} color={colors.brand} />
                <Text style={styles.emptyTitle}>CANTEIRO EM TEMPO REAL</Text>
                <Text style={styles.emptyText}>Pergunte sobre inspeções, EPIs, não conformidades, RDOs ou gere relatórios.</Text>
              </View>
              <Text style={styles.suggTitle}>SUGESTÕES</Text>
              {QUICK.map((q, i) => (
                <Pressable key={i} testID={`copilot-quick-${i}`} onPress={() => send(q)} style={styles.suggBtn}>
                  <Text style={styles.suggText}>{q}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.onSurface} />
                </Pressable>
              ))}
            </View>
          )}
          {messages.map((m) => (
            <View key={m.id} style={[styles.msgRow, m.role === "user" ? styles.msgUser : styles.msgAI]}>
              <Text style={[styles.msgLabel, m.role === "user" ? { color: colors.brandTertiary } : { color: colors.info }]}>
                {m.role === "user" ? "VOCÊ" : "IA"}
              </Text>
              <Text style={[styles.msgText, m.role === "user" && { color: colors.onBrand }]}>{m.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.msgRow, styles.msgAI]}>
              <Text style={[styles.msgLabel, { color: colors.info }]}>IA</Text>
              <ActivityIndicator color={colors.brand} />
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            testID="copilot-input"
            value={input}
            onChangeText={setInput}
            placeholder="Pergunte à IA..."
            placeholderTextColor={colors.info}
            style={styles.composerInput}
            multiline
            onSubmitEditing={() => send()}
          />
          <Pressable testID="copilot-send" onPress={() => send()} disabled={loading || !input.trim()} style={({ pressed }) => [styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}>
            <Ionicons name="send" size={20} color={colors.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong, backgroundColor: colors.surface },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderWidth: 2, borderColor: colors.error, paddingHorizontal: spacing.sm, paddingVertical: 6, marginRight: spacing.sm },
  logoutText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.xs, color: colors.error, letterSpacing: 0.5 },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  statusDot: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  dot: { width: 8, height: 8, backgroundColor: colors.success },
  hStatus: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.onSurface },
  stream: { flex: 1 },
  streamContent: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  emptyBlock: { gap: spacing.md },
  emptyBox: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.lg, letterSpacing: -0.3, color: colors.onSurface, marginTop: spacing.xs },
  emptyText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.info, lineHeight: 20 },
  suggTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700", marginTop: spacing.md },
  suggBtn: { borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, backgroundColor: colors.surface, minHeight: 52 },
  suggText: { flex: 1, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface },
  msgRow: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: 6 },
  msgUser: { backgroundColor: colors.brand, alignSelf: "flex-end", maxWidth: "88%" },
  msgAI: { backgroundColor: colors.surface, alignSelf: "flex-start", maxWidth: "92%" },
  msgLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.2, fontWeight: "700" },
  msgText: { fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, lineHeight: 22 },
  composer: { flexDirection: "row", padding: spacing.md, borderTopWidth: 2, borderTopColor: colors.borderStrong, backgroundColor: colors.surface, gap: spacing.sm, alignItems: "flex-end" },
  composerInput: { flex: 1, borderWidth: 2, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 48, maxHeight: 120, fontFamily: fonts.mono, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface },
  sendBtn: { width: 48, height: 48, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
}));
