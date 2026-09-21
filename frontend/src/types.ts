export type Client = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  state?: string;
  city?: string;
  contract_path?: string;
  notes?: string;
};

export type QuoteItem = { description: string; quantity: number; unit_price: number; detail?: string };

export type QuoteStatus = "rascunho" | "pendente" | "aprovado" | "rejeitado" | "concluido";

export type Quote = {
  id: string;
  number?: string;
  client_id?: string;
  client_name?: string;
  kind: "venda" | "servico";
  status: QuoteStatus;
  items: QuoteItem[];
  discount: number;
  tax: number;
  notes?: string;
  valid_until?: string;
  created_at?: string;
};

export type RackSlot = { u_start: number; u_size: number; kind: string; label: string; detail?: string; server_id?: string };

export type Rack = {
  id: string;
  name: string;
  client_id?: string;
  client_name?: string;
  size_u: number;
  location?: string;
  slots: RackSlot[];
};

export type TopoNode = {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  ip?: string;
  ports?: string;
  room?: string;
};

export type TopoLink = { id: string; source: string; target: string; label?: string };

export type Topology = {
  id: string;
  name: string;
  client_id?: string;
  client_name?: string;
  nodes: TopoNode[];
  links: TopoLink[];
};

export type FloorPoint = { id: string; x: number; y: number; label: string; kind: string; room?: string; detail?: string };
export type FloorRoom = { id: string; x: number; y: number; w: number; h: number; label: string };

export type FloorPlan = {
  id: string;
  name: string;
  client_id?: string;
  client_name?: string;
  mode: "upload" | "draw";
  image_path?: string;
  points: FloorPoint[];
  rooms: FloorRoom[];
};

export type Server = {
  id: string;
  name: string;
  client_id?: string;
  client_name?: string;
  host: string;
  port: number;
  state?: string;
  city?: string;
  map_x: number;
  map_y: number;
  os?: string;
  cpu?: string;
  ram?: string;
  disk?: string;
  role?: string;
  notes?: string;
  topology_id?: string;
  status: "online" | "offline" | "unknown";
  latency_ms?: number | null;
  last_check?: string;
  agent_key?: string;
  metrics?: ServerMetrics | null;
  metrics_history?: ServerMetrics[];
};

export type ServerMetrics = { cpu?: number; mem?: number; disk?: number; uptime?: string; hostname?: string; os?: string; at?: string };

export type Dashboard = {
  quotes_total: number;
  quotes_pending: number;
  quotes_approved: number;
  approved_value: number;
  clients_total: number;
  racks_total: number;
  servers_total: number;
  servers_offline: number;
  servers_online: number;
  devices_total: number;
  preventive_overdue: number;
  preventive_soon: number;
};

export const QUOTE_STATUS: { value: QuoteStatus; label: string }[] = [
  { value: "rascunho", label: "Rascunho" },
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
  { value: "concluido", label: "Concluído" },
];

export const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error" | "brand"> = {
  rascunho: "neutral",
  pendente: "warning",
  aprovado: "success",
  rejeitado: "error",
  concluido: "brand",
};

export function quoteSubtotal(q: Pick<Quote, "items">) {
  return q.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
}

export function quoteTotal(q: Pick<Quote, "items" | "discount" | "tax">) {
  return quoteSubtotal(q) - (Number(q.discount) || 0) + (Number(q.tax) || 0);
}

export function fmtBRL(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  const fixed = Math.abs(n).toFixed(2);
  const [int, dec] = fixed.split(".");
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}R$ ${withDots},${dec}`;
}

export function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
