import { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, PanResponder, Modal, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts, fontSize } from "@/src/theme";

const CANVAS_W = 320;
const CANVAS_H = 180;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: { dataUrl: string; hasContent: boolean }) => void;
};

// btoa polyfill for RN
const b64 = (s: string): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c1 = s.charCodeAt(i++);
    const c2 = i < s.length ? s.charCodeAt(i++) : NaN;
    const c3 = i < s.length ? s.charCodeAt(i++) : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    out += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return out;
};

export default function SignatureCanvas({ visible, onClose, onSave }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef<string>("");
  const [, setTick] = useState(0);
  const canvasRef = useRef<any>(null);

  // Web pointer handlers (react-native-web PanResponder does not populate locationX/Y).
  const getWebPoint = (e: any) => {
    const target = e.currentTarget || e.target;
    const rect = target?.getBoundingClientRect ? target.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: (e.clientX ?? 0) - rect.left, y: (e.clientY ?? 0) - rect.top };
  };
  const drawing = useRef(false);
  const onWebDown = (e: any) => {
    e.preventDefault?.();
    const { x, y } = getWebPoint(e);
    drawing.current = true;
    currentPath.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
    setTick((t) => t + 1);
    try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch {}
  };
  const onWebMove = (e: any) => {
    if (!drawing.current) return;
    const { x, y } = getWebPoint(e);
    currentPath.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    setTick((t) => t + 1);
  };
  const onWebUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (currentPath.current) {
      setPaths((prev) => [...prev, currentPath.current]);
      currentPath.current = "";
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setTick((t) => t + 1);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setTick((t) => t + 1);
      },
      onPanResponderRelease: () => {
        if (currentPath.current) {
          setPaths((prev) => [...prev, currentPath.current]);
          currentPath.current = "";
        }
      },
    }),
  ).current;

  const clear = () => {
    setPaths([]);
    currentPath.current = "";
  };

  const save = () => {
    const allPaths = [...paths, currentPath.current].filter(Boolean);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">` +
      `<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#FFFFFF"/>` +
      allPaths
        .map(
          (d) =>
            `<path d="${d}" stroke="#09090B" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
        .join("") +
      `</svg>`;
    const dataUrl = `data:image/svg+xml;base64,${b64(svg)}`;
    onSave({ dataUrl, hasContent: allPaths.length > 0 });
    setPaths([]);
    currentPath.current = "";
  };

  const drawn = paths.length > 0 || currentPath.current.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View>
              <Text style={styles.label}>ASSINATURA DIGITAL</Text>
              <Text style={styles.title}>Assine na área abaixo</Text>
            </View>
            <Pressable testID="signature-close" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurface} />
            </Pressable>
          </View>

          <View
            testID="signature-canvas"
            ref={canvasRef}
            style={styles.canvasWrap}
            {...(Platform.OS === "web"
              ? ({ onPointerDown: onWebDown, onPointerMove: onWebMove, onPointerUp: onWebUp, onPointerLeave: onWebUp, onPointerCancel: onWebUp } as any)
              : responder.panHandlers)}
          >
            <Svg width={CANVAS_W} height={CANVAS_H}>
              {paths.map((d, i) => (
                <Path key={i} d={d} stroke={colors.onSurface} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentPath.current ? (
                <Path d={currentPath.current} stroke={colors.onSurface} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </Svg>
            {!drawn && (
              <View style={[styles.hint, { pointerEvents: "none" }]}>
                <Text style={styles.hintText}>ASSINE AQUI</Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable testID="signature-clear" onPress={clear} style={styles.secondaryBtn}>
              <Ionicons name="refresh" size={16} color={colors.onSurface} />
              <Text style={styles.secondaryBtnText}>LIMPAR</Text>
            </Pressable>
            <Pressable testID="signature-save" onPress={save} disabled={!drawn} style={[styles.primaryBtn, !drawn && { opacity: 0.4 }]}>
              <Ionicons name="checkmark" size={16} color={colors.onBrand} />
              <Text style={styles.primaryBtnText}>CONFIRMAR</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(9,9,11,0.7)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  sheet: { width: "100%", maxWidth: 380, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.borderStrong, padding: spacing.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.info, fontWeight: "700" },
  title: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.3, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  canvasWrap: { width: CANVAS_W, height: CANVAS_H, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignSelf: "center", overflow: "hidden" },
  hint: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" },
  hintText: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 2, color: colors.surfaceTertiary, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  secondaryBtn: { flex: 1, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surface, minHeight: 48 },
  secondaryBtnText: { fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 0.5, color: colors.onSurface },
  primaryBtn: { flex: 1, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.borderStrong, paddingVertical: spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: spacing.sm, minHeight: 48 },
  primaryBtnText: { color: colors.onBrand, fontFamily: fonts.display, fontWeight: "900", fontSize: fontSize.sm, letterSpacing: 0.5 },
});
