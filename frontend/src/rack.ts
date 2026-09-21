import type { RackSlot } from "@/src/types";
import { currentCompany, docHeaderHtml } from "@/src/brand";

export type RackKind = {
  kind: string;
  label: string;
  size: number;
  icon: string;
  colorKey: "brandPrimary" | "success" | "warning" | "error" | "onSurfaceTertiary" | "muted";
};

export const RACK_CATALOG: RackKind[] = [
  { kind: "switch48", label: "Switch 48 portas", size: 1, icon: "swap-horizontal", colorKey: "brandPrimary" },
  { kind: "switch24", label: "Switch 24 portas", size: 1, icon: "swap-horizontal", colorKey: "brandPrimary" },
  { kind: "switch8", label: "Switch 8 portas", size: 1, icon: "swap-horizontal", colorKey: "brandPrimary" },
  { kind: "patch48", label: "Patch panel 48p", size: 2, icon: "grid", colorKey: "onSurfaceTertiary" },
  { kind: "patch24", label: "Patch panel 24p", size: 1, icon: "grid", colorKey: "onSurfaceTertiary" },
  { kind: "cable_guide", label: "Guia de cabos", size: 1, icon: "reorder-three", colorKey: "muted" },
  { kind: "blank", label: "Painel cego", size: 1, icon: "remove", colorKey: "muted" },
  { kind: "router", label: "Roteador", size: 1, icon: "globe", colorKey: "warning" },
  { kind: "firewall", label: "Firewall", size: 1, icon: "shield-checkmark", colorKey: "error" },
  { kind: "server1", label: "Servidor 1U", size: 1, icon: "server", colorKey: "success" },
  { kind: "server2", label: "Servidor 2U", size: 2, icon: "server", colorKey: "success" },
  { kind: "server4", label: "Servidor 4U", size: 4, icon: "server", colorKey: "success" },
  { kind: "tower", label: "Servidor torre (bandeja)", size: 5, icon: "cube", colorKey: "success" },
  { kind: "storage", label: "Storage / NAS", size: 2, icon: "file-tray-stacked", colorKey: "success" },
  { kind: "nvr", label: "NVR / DVR", size: 2, icon: "videocam", colorKey: "warning" },
  { kind: "ups", label: "Nobreak / UPS", size: 2, icon: "battery-charging", colorKey: "warning" },
  { kind: "pdu", label: "PDU / Régua", size: 1, icon: "flash", colorKey: "warning" },
  { kind: "dio", label: "DIO (fibra)", size: 1, icon: "git-merge", colorKey: "onSurfaceTertiary" },
  { kind: "kvm", label: "KVM", size: 1, icon: "tv", colorKey: "onSurfaceTertiary" },
  { kind: "shelf", label: "Bandeja", size: 1, icon: "albums", colorKey: "muted" },
  { kind: "generic", label: "Outro equipamento", size: 1, icon: "cube", colorKey: "onSurfaceTertiary" },
];

export const RACK_KIND_MAP = Object.fromEntries(RACK_CATALOG.map((k) => [k.kind, k])) as Record<string, RackKind>;

export const RACK_SIZES = [6, 12, 16, 24, 32, 42, 44, 48, 50];

export function slotRange(s: RackSlot) {
  return { bottom: s.u_start, top: s.u_start + s.u_size - 1 };
}

export function slotFits(slots: RackSlot[], candidate: RackSlot, sizeU: number, ignoreIdx = -1) {
  const { bottom, top } = slotRange(candidate);
  if (bottom < 1 || top > sizeU) return false;
  return slots.every((s, i) => {
    if (i === ignoreIdx) return true;
    const r = slotRange(s);
    return top < r.bottom || bottom > r.top;
  });
}

export function rackHtml(rack: { name: string; client_name?: string; location?: string; size_u: number; slots: RackSlot[] }) {
  const byTop = new Map<number, RackSlot>();
  const occupied = new Set<number>();
  rack.slots.forEach((s) => {
    const r = slotRange(s);
    byTop.set(r.top, s);
    for (let u = r.bottom; u <= r.top; u++) occupied.add(u);
  });
  let rows = "";
  for (let u = rack.size_u; u >= 1; u--) {
    const s = byTop.get(u);
    if (s) {
      const meta = RACK_KIND_MAP[s.kind];
      const face = s.kind.startsWith("switch") || s.kind.startsWith("patch") ? "ports" : s.kind.startsWith("server") || s.kind === "storage" || s.kind === "nvr" ? "bays" : s.kind === "blank" || s.kind === "cable_guide" ? "flat" : "box";
      rows += `<tr style="height:${6 * s.u_size}mm"><td class="u">${u}${s.u_size > 1 ? `–${u - s.u_size + 1}` : ""}</td><td class="eq ${face}"><span class="led"></span><span class="lbl">${s.label || meta?.label || s.kind}</span><span class="k">${meta?.label ?? s.kind} · ${s.u_size}U${s.detail ? ` · ${s.detail}` : ""}</span></td></tr>`;
    } else if (!occupied.has(u)) {
      rows += `<tr><td class="u">${u}</td><td class="empty"></td></tr>`;
    }
  }
  return `<html><head><meta charset="utf-8"/><style>
  body{font-family:Helvetica,Arial,sans-serif;color:#111;padding:24px}
  h1{margin:0 0 4px;font-size:22px} .sub{color:#666;font-size:12px;margin-bottom:16px}
  table{border-collapse:collapse;width:100%;max-width:520px}
  td{border:1px solid #444;padding:4px 8px;font-size:12px;height:20px}
  td.u{width:48px;text-align:center;background:#222;color:#fff;font-weight:bold}
  td.eq{position:relative;color:#fff;background:#1b1d22;border-left:4px solid #2DD4F5}
  td.eq.ports{background:#1b1d22 repeating-linear-gradient(90deg,#0b0c10 0 5px,#4b5563 5px 6px,#1b1d22 6px 8px)}
  td.eq.bays{background:repeating-linear-gradient(90deg,#3a3e47 0 14px,#1b1d22 14px 16px)}
  td.eq.flat{background:#15171c;border-left-color:#4b5563}
  td.eq.box{background:#23262d}
  .lbl{background:rgba(0,0,0,.65);padding:1px 6px;border-radius:3px;font-weight:bold}
  .led{display:inline-block;width:6px;height:6px;border-radius:3px;background:#22c55e;box-shadow:0 0 4px #22c55e;margin-right:6px}
  td.empty{background:#fafafa}
  .k{float:right;color:#cbd5e1;font-size:9px;background:rgba(0,0,0,.5);padding:1px 4px;border-radius:3px}
  </style></head><body>
  ${docHeaderHtml()}
  <h1>${rack.name}</h1>
  <div class="sub">${rack.client_name ? `Cliente: ${rack.client_name} · ` : ""}${rack.location ? `Local: ${rack.location} · ` : ""}${rack.size_u}U · ${rack.slots.length} equipamentos</div>
  <table>${rows}</table>
  <p style="color:#999;font-size:10px;margin-top:24px">${currentCompany()}</p>
  </body></html>`;
}
