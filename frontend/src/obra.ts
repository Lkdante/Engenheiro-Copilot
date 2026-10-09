// Utilidades da obra (datas BR, porte)

export const SIZES = [
  { id: "pequeno", label: "PEQUENO" },
  { id: "medio", label: "MÉDIO" },
  { id: "grande", label: "GRANDE" },
];

export function sizeLabel(size?: string | null): string {
  return SIZES.find((s) => s.id === size)?.label || (size || "—").toUpperCase();
}

/** "2026-03-01" -> "01/03/2026" */
export function formatDateBR(iso?: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Máscara de digitação: "01032026" -> "01/03/2026" */
export function maskDateBR(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Valida "DD/MM/AAAA" de verdade (dia/mês existentes). */
export function isValidDateBR(text: string): boolean {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** "01/03/2026" -> Date para comparar */
export function brToTime(text: string): number {
  const [d, m, y] = text.split("/").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export type PublicObra = {
  id: string;
  name: string;
  address: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  company: string | null;
  art: string | null;
  size: string | null;
  status: string;
  workers_total: number;
  days_left: number | null;
  created_at: string;
};
