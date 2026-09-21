import { fileUrl } from "@/src/api";
import { currentCompany, docHeaderHtml } from "@/src/brand";
import { TOPOLOGY_CSS, topologySection } from "@/src/topology";
import type { FloorPlan, Topology } from "@/src/types";

const POINT_STYLE: Record<string, { label: string; color: string; symbol: string }> = {
  network: { label: "Ponto de rede (RJ45)", color: "#17A74A", symbol: "●" },
  wifi: { label: "Access Point", color: "#0E8A5F", symbol: "◉" },
  camera: { label: "Câmera", color: "#C77A00", symbol: "■" },
  phone: { label: "Telefone", color: "#555", symbol: "☎" },
  rack: { label: "Rack", color: "#D6294B", symbol: "▣" },
  power: { label: "Tomada elétrica", color: "#C77A00", symbol: "⚡" },
};

export function floorplanHtml(fp: FloorPlan, topologies: Topology[], imageRatio: number) {
  const ratio = fp.mode === "upload" ? imageRatio || 1.4 : 1.4;
  const roomAt = (x: number, y: number) => fp.rooms.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.label;
  const background =
    fp.mode === "upload"
      ? fp.image_path
        ? `<img src="${fileUrl(fp.image_path)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill"/>`
        : `<div class="empty">Sem imagem da planta</div>`
      : `<svg viewBox="0 0 100 71.4" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;border:0;max-height:none" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="g" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0 L0 0 0 5" fill="none" stroke="#e3e3e3" stroke-width="0.2"/></pattern></defs>
          <rect width="100" height="71.4" fill="#fafafa"/><rect width="100" height="71.4" fill="url(#g)"/>
          ${fp.rooms.map((r) => `<rect x="${r.x}" y="${r.y * 0.714}" width="${r.w}" height="${r.h * 0.714}" fill="#eef3f0" stroke="#333" stroke-width="0.5"/><text x="${r.x + 1}" y="${r.y * 0.714 + 3}" font-size="2.6" fill="#111">${r.label}</text>`).join("")}
        </svg>`;
  const markers = fp.points
    .map((p) => {
      const k = POINT_STYLE[p.kind] ?? POINT_STYLE.network;
      return `<div class="pt" style="left:${p.x}%;top:${p.y}%;border-color:${k.color};color:${k.color}"><span>${k.symbol}</span><b>${p.label}</b></div>`;
    })
    .join("");
  const rows = fp.points
    .map((p) => {
      const k = POINT_STYLE[p.kind] ?? POINT_STYLE.network;
      return `<tr><td><b>${p.label}</b></td><td style="color:${k.color}">${k.symbol} ${k.label}</td><td>${p.room || roomAt(p.x, p.y) || "—"}</td><td>${p.detail || ""}</td></tr>`;
    })
    .join("");
  const counts = Object.entries(POINT_STYLE)
    .map(([kind, k]) => ({ k, n: fp.points.filter((p) => p.kind === kind).length }))
    .filter((x) => x.n > 0)
    .map((x) => `<span style="color:${x.k.color};margin-right:12px">${x.k.symbol} ${x.k.label}: <b>${x.n}</b></span>`)
    .join("");
  const topos = topologies
    .map((t) => `<div class="pb"><h2>Topologia de rede — ${t.name}</h2><div class="sub">${t.nodes.length} dispositivos · ${t.links.length} conexões</div>${topologySection(t)}</div>`)
    .join("");

  return `<html><head><meta charset="utf-8"/><style>${TOPOLOGY_CSS}
  .plan{position:relative;width:100%;aspect-ratio:${ratio};border:1px solid #999;background:#fff;overflow:hidden;page-break-inside:avoid}
  .empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#999}
  .pt{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:3px;background:rgba(255,255,255,.92);border:1.5px solid;border-radius:4px;padding:1px 4px;font-size:9px;white-space:nowrap}
  .pt b{color:#111}.legend{font-size:11px;margin-top:8px}.pb{page-break-before:always}
  </style></head><body>
  ${docHeaderHtml()}
  <h1>${fp.name || "Planta baixa"}</h1>
  <div class="sub">${fp.client_name ? `Cliente: ${fp.client_name} · ` : ""}${fp.points.length} pontos de rede${fp.rooms.length ? ` · ${fp.rooms.length} cômodos` : ""}</div>
  <div class="plan">${background}${markers}</div>
  <div class="legend">${counts || "Nenhum ponto marcado"}</div>
  <h2>Pontos de rede (${fp.points.length})</h2>
  <table><tr><th>Ponto</th><th>Tipo</th><th>Cômodo</th><th>Detalhes</th></tr>${rows || `<tr><td colspan="4" style="color:#999">Nenhum ponto</td></tr>`}</table>
  ${topos || (fp.client_id ? `<p style="color:#999;font-size:11px;margin-top:16px">Nenhuma topologia de rede cadastrada para este cliente.</p>` : "")}
  <p style="color:#999;font-size:10px;margin-top:24px">${currentCompany()}</p></body></html>`;
}
