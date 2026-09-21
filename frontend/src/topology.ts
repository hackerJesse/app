import type { TopoLink, TopoNode } from "@/src/types";
import { currentCompany, docHeaderHtml } from "@/src/brand";
import { uid } from "@/src/types";

export const CANVAS_W = 1400;
export const CANVAS_H = 1000;
export const NODE_SIZE = 56;

export type NodeKind = {
  kind: string;
  label: string;
  icon: string;
  color: string; // hex — printed in PDF and kept identical across themes
};

export const NODE_KINDS: NodeKind[] = [
  { kind: "internet", label: "Internet / WAN", icon: "cloud", color: "#8A90C2" },
  { kind: "router", label: "Roteador", icon: "globe", color: "#FFC857" },
  { kind: "firewall", label: "Firewall", icon: "shield-checkmark", color: "#FF5470" },
  { kind: "switch", label: "Switch", icon: "swap-horizontal", color: "#2DD4F5" },
  { kind: "server", label: "Servidor", icon: "server", color: "#3DF58C" },
  { kind: "ap", label: "Access Point", icon: "wifi", color: "#4F7CFF" },
  { kind: "pc", label: "Computador", icon: "desktop", color: "#C3C8F0" },
  { kind: "laptop", label: "Notebook", icon: "laptop", color: "#C3C8F0" },
  { kind: "printer", label: "Impressora", icon: "print", color: "#C3C8F0" },
  { kind: "camera", label: "Câmera IP", icon: "videocam", color: "#FFC857" },
  { kind: "nvr", label: "NVR / DVR", icon: "film", color: "#FFC857" },
  { kind: "phone", label: "Telefone IP", icon: "call", color: "#C3C8F0" },
  { kind: "storage", label: "Storage / NAS", icon: "file-tray-stacked", color: "#3DF58C" },
];

export const NODE_KIND_MAP = Object.fromEntries(NODE_KINDS.map((k) => [k.kind, k])) as Record<string, NodeKind>;

export type AutoConfig = {
  hasInternet: boolean;
  routers: number;
  switches: number;
  servers: number;
  pcs: number;
  aps: number;
  printers: number;
  cameras: number;
};

export const DEFAULT_AUTO: AutoConfig = {
  hasInternet: true,
  routers: 1,
  switches: 2,
  servers: 1,
  pcs: 6,
  aps: 2,
  printers: 1,
  cameras: 0,
};

function spread(count: number, y: number, width = CANVAS_W): { x: number; y: number }[] {
  const gap = width / (count + 1);
  return Array.from({ length: count }, (_, i) => ({ x: Math.round(gap * (i + 1)), y }));
}

export function autoGenerate(cfg: AutoConfig): { nodes: TopoNode[]; links: TopoLink[] } {
  const nodes: TopoNode[] = [];
  const links: TopoLink[] = [];
  const mk = (kind: string, label: string, x: number, y: number, ip = ""): TopoNode => {
    const n = { id: uid(), kind, label, x, y, ip, ports: "", room: "" };
    nodes.push(n);
    return n;
  };
  const link = (a: TopoNode, b: TopoNode, label = "") => links.push({ id: uid(), source: a.id, target: b.id, label });

  let internet: TopoNode | null = null;
  if (cfg.hasInternet) internet = mk("internet", "Internet", CANVAS_W / 2, 80);

  const routers = spread(Math.max(cfg.routers, 0), 220).map((p, i) => mk("router", `Roteador ${i + 1}`, p.x, p.y, `192.168.${i}.1`));
  routers.forEach((r) => internet && link(internet, r, "WAN"));

  const switches = spread(cfg.switches, 400).map((p, i) => mk("switch", `Switch ${i + 1}`, p.x, p.y, `192.168.0.${10 + i}`));
  switches.forEach((s, i) => {
    const r = routers[i % Math.max(routers.length, 1)];
    if (r) link(r, s, "Uplink");
  });
  // daisy-chain switches if no routers
  if (!routers.length) switches.forEach((s, i) => i > 0 && link(switches[i - 1], s, "Trunk"));

  const parents = switches.length ? switches : routers;
  const endDevices: { kind: string; label: string }[] = [];
  for (let i = 0; i < cfg.servers; i++) endDevices.push({ kind: "server", label: `Servidor ${i + 1}` });
  for (let i = 0; i < cfg.aps; i++) endDevices.push({ kind: "ap", label: `AP ${i + 1}` });
  for (let i = 0; i < cfg.printers; i++) endDevices.push({ kind: "printer", label: `Impressora ${i + 1}` });
  for (let i = 0; i < cfg.cameras; i++) endDevices.push({ kind: "camera", label: `Câmera ${i + 1}` });
  for (let i = 0; i < cfg.pcs; i++) endDevices.push({ kind: "pc", label: `PC ${i + 1}` });

  const perRow = 8;
  endDevices.forEach((d, i) => {
    const row = Math.floor(i / perRow);
    const idxInRow = i % perRow;
    const rowCount = Math.min(perRow, endDevices.length - row * perRow);
    const pos = spread(rowCount, 600 + row * 150)[idxInRow];
    const n = mk(d.kind, d.label, pos.x, pos.y, `192.168.0.${100 + i}`);
    const parent = parents[i % Math.max(parents.length, 1)];
    if (parent) link(parent, n, `P${(i % 24) + 1}`);
  });

  return { nodes, links };
}

export function topologyHtml(t: { name: string; client_name?: string; nodes: TopoNode[]; links: TopoLink[] }) {
  const xs = t.nodes.map((n) => n.x);
  const ys = t.nodes.map((n) => n.y);
  const minX = Math.min(...xs, 0) - 80;
  const minY = Math.min(...ys, 0) - 80;
  const maxX = Math.max(...xs, 400) + 80;
  const maxY = Math.max(...ys, 300) + 80;
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  const lines = t.links
    .map((l) => {
      const a = byId.get(l.source);
      const b = byId.get(l.target);
      if (!a || !b) return "";
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#555" stroke-width="2"/>${
        l.label ? `<text x="${mx}" y="${my - 4}" font-size="11" fill="#333" text-anchor="middle">${l.label}</text>` : ""
      }`;
    })
    .join("");
  const nodes = t.nodes
    .map((n) => {
      const k = NODE_KIND_MAP[n.kind];
      return `<g><rect x="${n.x - 26}" y="${n.y - 26}" width="52" height="52" rx="6" fill="${k?.color ?? "#999"}" stroke="#222"/>
      <text x="${n.x}" y="${n.y + 4}" font-size="10" fill="#111" text-anchor="middle">${(k?.label ?? n.kind).split(" ")[0]}</text>
      <text x="${n.x}" y="${n.y + 42}" font-size="12" font-weight="bold" fill="#111" text-anchor="middle">${n.label}</text>
      ${n.ip ? `<text x="${n.x}" y="${n.y + 56}" font-size="10" fill="#555" text-anchor="middle">${n.ip}</text>` : ""}</g>`;
    })
    .join("");
  const rows = t.nodes
    .map((n) => `<tr><td>${n.label}</td><td>${NODE_KIND_MAP[n.kind]?.label ?? n.kind}</td><td>${n.ip ?? ""}</td><td>${n.ports ?? ""}</td><td>${n.room ?? ""}</td></tr>`)
    .join("");
  return `<html><head><meta charset="utf-8"/><style>
  body{font-family:Helvetica,Arial,sans-serif;color:#111;padding:24px}
  h1{margin:0 0 4px;font-size:22px}.sub{color:#666;font-size:12px;margin-bottom:12px}
  svg{border:1px solid #ccc;width:100%;height:auto;max-height:560px}
  table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}
  th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#eee}
  </style></head><body>
  ${docHeaderHtml()}
  <h1>${t.name}</h1><div class="sub">${t.client_name ? `Cliente: ${t.client_name} · ` : ""}${t.nodes.length} dispositivos · ${t.links.length} conexões</div>
  <svg viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" xmlns="http://www.w3.org/2000/svg">${lines}${nodes}</svg>
  <table><tr><th>Dispositivo</th><th>Tipo</th><th>IP</th><th>Portas</th><th>Local</th></tr>${rows}</table>
  <p style="color:#999;font-size:10px;margin-top:24px">${currentCompany()}</p></body></html>`;
}
