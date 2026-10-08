// Design tokens - Brutalist Mobile personality
export const colors = {
  surface: "#FFFFFF",
  onSurface: "#09090B",
  surfaceSecondary: "#F4F4F5",
  onSurfaceSecondary: "#18181B",
  surfaceTertiary: "#E4E4E7",
  onSurfaceTertiary: "#27272A",
  surfaceInverse: "#09090B",
  onSurfaceInverse: "#FFFFFF",
  brand: "#FF5E00",
  brandSecondary: "#CC4B00",
  brandTertiary: "#FFEFE5",
  onBrand: "#FFFFFF",
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
  info: "#52525B",
  border: "#E4E4E7",
  borderStrong: "#09090B",
  divider: "#E4E4E7",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
import { Platform } from "react-native";

export const fonts = {
  display: Platform.select({ ios: "System", android: "sans-serif", default: "System" })!,
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })!,
};
export const fontSize = { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 44 };

export const roleLabel: Record<string, string> = {
  estagiario: "ESTAGIÁRIO",
  engenheiro: "ENGENHEIRO",
  mestre_obras: "MESTRE DE OBRAS",
  tec_seguranca: "TÉC. SEGURANÇA",
  diretor: "DIRETOR",
};

export const severityColor: Record<string, string> = {
  baixa: colors.info,
  media: colors.warning,
  alta: "#EA580C",
  critica: colors.error,
};
