// Configurações: Visibilidade (tema escuro frio), Acessibilidade e Privacidade.
import { useCallback, useState, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, Switch, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { clearAuth, getStoredUser } from "@/src/api";
import { darkPalette, lightPalette, spacing, fonts, type Palette } from "@/src/theme";
import { makeStyles, useTheme, type CardMode, type SortMode, type ThemeMode } from "@/src/settings";

function confirm(title: string, msg: string, onOk: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${msg}`)) onOk();
    return;
  }
  Alert.alert(title, msg, [{ text: "Cancelar", style: "cancel" }, { text: "Confirmar", style: "destructive", onPress: onOk }]);
}

export default function Configuracoes() {
  const { colors, settings, update, reset } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useFocusEffect(useCallback(() => { (async () => setUser(await getStoredUser()))(); }, []));

  const themes: { id: ThemeMode; label: string; palette: Palette; icon: any }[] = [
    { id: "light", label: "CLARO", palette: lightPalette, icon: "sunny" },
    { id: "dark", label: "ESCURO", palette: darkPalette, icon: "moon" },
    { id: "system", label: "SISTEMA", palette: lightPalette, icon: "phone-portrait" },
  ];

  const clearDevice = () =>
    confirm("Limpar dados do aparelho", "Sai da conta, esquece a última obra acessada e restaura as configurações padrão. Os dados das obras no servidor não são apagados.", async () => {
      await clearAuth();
      reset();
      setUser(null);
    });

  const logout = () =>
    confirm("Sair da conta", "Você continuará vendo o menu público de obras.", async () => {
      await clearAuth();
      setUser(null);
    });

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/obras"))} style={styles.back} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hLabel}>AJUSTES DO APLICATIVO</Text>
          <Text style={styles.hTitle}>Configurações</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ---------------- VISIBILIDADE ---------------- */}
        <Section icon="eye" title="VISIBILIDADE">
          <Text style={styles.label}>TEMA</Text>
          <View style={styles.themeRow}>
            {themes.map((t) => {
              const active = settings.theme === t.id;
              return (
                <Pressable
                  key={t.id}
                  testID={`tema-${t.id}`}
                  onPress={() => update({ theme: t.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Tema ${t.label.toLowerCase()}`}
                  style={[styles.themeCard, active && styles.themeCardActive]}
                >
                  <View style={[styles.swatch, { backgroundColor: t.palette.surface, borderColor: t.palette.borderStrong }]}>
                    {t.id === "system" ? (
                      <View style={[styles.swatchHalf, { backgroundColor: darkPalette.surface }]} />
                    ) : null}
                    <View style={[styles.swatchBar, { backgroundColor: t.palette.brand }]} />
                    <View style={[styles.swatchLine, { backgroundColor: t.palette.onSurface }]} />
                    <View style={[styles.swatchLine, { backgroundColor: t.palette.info, width: "50%" }]} />
                  </View>
                  <View style={styles.themeLabelRow}>
                    <Ionicons name={t.icon} size={14} color={active ? colors.brand : colors.info} />
                    <Text style={[styles.themeLabel, active && { color: colors.brand }]}>{t.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>O tema escuro usa tons frios (azul-ardósia e ciano) para reduzir o brilho e o cansaço visual.</Text>

          <Text style={styles.label}>EXIBIÇÃO DAS OBRAS NO MENU</Text>
          <Segmented<CardMode>
            value={settings.cardMode}
            onChange={(v) => update({ cardMode: v })}
            options={[{ id: "detalhado", label: "DETALHADO" }, { id: "compacto", label: "COMPACTO" }]}
          />

          <Text style={styles.label}>ORDENAR OBRAS POR</Text>
          <Segmented<SortMode>
            value={settings.sortBy}
            onChange={(v) => update({ sortBy: v })}
            options={[{ id: "recentes", label: "RECENTES" }, { id: "nome", label: "NOME" }, { id: "termino", label: "TÉRMINO" }]}
          />

          <Toggle
            label="Mostrar obras concluídas"
            hint="Obras com estágio em 100% aparecem no menu."
            value={settings.showFinished}
            onChange={(v) => update({ showFinished: v })}
          />
        </Section>

        {/* ---------------- ACESSIBILIDADE ---------------- */}
        <Section icon="accessibility" title="ACESSIBILIDADE">
          <Text style={styles.label}>TAMANHO DO TEXTO</Text>
          <Segmented<string>
            value={String(settings.textScale)}
            onChange={(v) => update({ textScale: Number(v) })}
            options={[{ id: "1", label: "NORMAL" }, { id: "1.15", label: "GRANDE" }, { id: "1.3", label: "EXTRA" }]}
          />
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>Residencial Vila Nova</Text>
            <Text style={styles.previewText}>Pré-visualização do texto com o tamanho escolhido.</Text>
          </View>

          <Toggle
            label="Alto contraste"
            hint="Bordas e textos secundários mais fortes — melhor sob sol forte no canteiro."
            value={settings.highContrast}
            onChange={(v) => update({ highContrast: v })}
          />
        </Section>

        {/* ---------------- PRIVACIDADE ---------------- */}
        <Section icon="lock-closed" title="PRIVACIDADE">
          <Toggle
            label="Manter conectado neste aparelho"
            hint="Desligado: a sessão é encerrada sempre que o app é fechado. Recomendado em aparelhos compartilhados."
            value={settings.rememberSession}
            onChange={(v) => update({ rememberSession: v })}
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>O QUE QUALQUER PESSOA VÊ (SEM LOGIN)</Text>
            <Text style={styles.infoText}>Nome da obra, localidade, início, término previsto, estágio (%), empresa responsável, ART, porte e número de funcionários.</Text>
            <Text style={[styles.infoTitle, { marginTop: spacing.sm }]}>O QUE EXIGE LOGIN</Text>
            <Text style={styles.infoText}>Dashboard, copiloto IA, RDOs, não conformidades, EPIs, checklists, fotos, inspeções, lista de funcionários e integrações.</Text>
          </View>

          {user ? (
            <Pressable testID="config-logout" onPress={logout} style={styles.outlineBtn}>
              <Ionicons name="log-out-outline" size={18} color={colors.onSurface} />
              <Text style={styles.outlineText}>SAIR DA CONTA ({user.email})</Text>
            </Pressable>
          ) : null}
          <Pressable testID="config-clear" onPress={clearDevice} style={[styles.outlineBtn, { borderColor: colors.error }]}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.outlineText, { color: colors.error }]}>LIMPAR DADOS DESTE APARELHO</Text>
          </Pressable>
        </Section>

        <Pressable onPress={() => confirm("Restaurar padrões", "Volta tema, texto e exibição para o padrão.", reset)} style={styles.resetBtn}>
          <Text style={styles.resetText}>Restaurar configurações padrão</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={18} color={colors.brand} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  const styles = useStyles();
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceTertiary, true: colors.brand }}
        thumbColor={value ? colors.onBrand : colors.info}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((colors, fontSize) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  back: { width: 40, height: 40, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  hLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  hTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] },
  section: { borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xs },
  sectionTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.base, color: colors.onSurface, letterSpacing: 1 },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1, color: colors.onSurface, fontWeight: "700", marginTop: spacing.sm },
  hint: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, lineHeight: Math.round(fontSize.xs * 1.45) },
  themeRow: { flexDirection: "row", gap: spacing.sm },
  themeCard: { flex: 1, borderWidth: 2, borderColor: colors.border, padding: spacing.sm, gap: spacing.sm, alignItems: "center" },
  themeCardActive: { borderColor: colors.brand, borderWidth: 3 },
  swatch: { width: "100%", height: 64, borderWidth: 2, padding: 6, gap: 5, overflow: "hidden" },
  swatchHalf: { position: "absolute", right: 0, top: 0, bottom: 0, width: "50%" },
  swatchBar: { height: 10, width: "70%" },
  swatchLine: { height: 4, width: "85%" },
  themeLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  themeLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.onSurface, letterSpacing: 0.5 },
  segment: { flexDirection: "row", borderWidth: 2, borderColor: colors.borderStrong },
  segItem: { flex: 1, paddingVertical: spacing.md, alignItems: "center", backgroundColor: colors.surface },
  segItemActive: { backgroundColor: colors.brand },
  segText: { fontFamily: fonts.mono, fontSize: fontSize.xs, fontWeight: "700", color: colors.onSurface, letterSpacing: 0.5 },
  segTextActive: { color: colors.onBrand },
  preview: { borderWidth: 1, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surfaceSecondary, gap: 4 },
  previewTitle: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.lg, color: colors.onSurface },
  previewText: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.xs },
  toggleLabel: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, color: colors.onSurface },
  infoBox: { borderWidth: 1, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surfaceSecondary },
  infoTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.onSurface, fontWeight: "700", letterSpacing: 0.5 },
  infoText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, marginTop: 2, lineHeight: Math.round(fontSize.xs * 1.45) },
  outlineBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.borderStrong, minHeight: 48, paddingHorizontal: spacing.md },
  outlineText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.xs, color: colors.onSurface, letterSpacing: 0.5, flexShrink: 1 },
  resetBtn: { alignItems: "center", padding: spacing.md },
  resetText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.info, textDecorationLine: "underline" },
}));
