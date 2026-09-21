import { currentCompany, docHeaderHtml } from "@/src/brand";
import { DEVICE_KIND_MAP, DEVICE_STATUS, Device, Maintenance, specSummary } from "@/src/devices";
import { Server, fmtBRL, fmtDate } from "@/src/types";

export type Period = { from?: string; to?: string };

// "dd/mm/aaaa" -> Date (start of day) | undefined
export function parseBr(v?: string): Date | undefined {
  if (!v) return undefined;
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function inPeriod(iso: string | undefined, p: Period) {
  if (!iso) return !p.from && !p.to;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const from = parseBr(p.from);
  const to = parseBr(p.to);
  if (from && d < from) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}

const STATUS_LABEL = Object.fromEntries(DEVICE_STATUS.map((s) => [s.value, s.label]));

const CSS = `
  body{font-family:Helvetica,Arial,sans-serif;color:#111;padding:24px;font-size:12px}
  h1{margin:0 0 4px;font-size:22px}.sub{color:#666;font-size:12px;margin-bottom:12px}
  h2{font-size:14px;margin:18px 0 6px;color:#333;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #17A74A;padding-bottom:4px}
  table{border-collapse:collapse;width:100%;margin-top:6px;font-size:11px}
  th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee}
  .kpis{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
  .kpi{border:1px solid #ddd;border-radius:6px;padding:8px 12px;min-width:110px}
  .kpi b{display:block;font-size:20px}.kpi span{color:#666;font-size:10px;text-transform:uppercase}
  .muted{color:#777}.r{text-align:right}
  .foot{margin-top:24px;color:#999;font-size:10px}
  .card{border:1px solid #ddd;border-radius:6px;padding:10px;margin-top:8px;page-break-inside:avoid}
  .card h3{margin:0 0 4px;font-size:14px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:11px}
  .ok{color:#12995A;font-weight:bold}.off{color:#D6294B;font-weight:bold}.unk{color:#999}
`;

function periodLabel(p: Period) {
  if (!p.from && !p.to) return "todo o período";
  return `${p.from || "início"} até ${p.to || "hoje"}`;
}

export type DevicesReportInput = {
  devices: Device[];
  maintenances: Maintenance[];
  created: Period;
  maint: Period;
  clientName?: string;
  kind?: string;
};

export function devicesReportHtml(inp: DevicesReportInput) {
  const devs = inp.devices;
  const maint = inp.maintenances;
  const byDevice = new Map<string, Maintenance[]>();
  maint.forEach((m) => byDevice.set(m.device_id, [...(byDevice.get(m.device_id) ?? []), m]));
  const prev = maint.filter((m) => m.kind === "preventiva").length;
  const corr = maint.length - prev;
  const cost = maint.reduce((s, m) => s + (Number(m.cost) || 0), 0);
  const byKind = new Map<string, number>();
  devs.forEach((d) => byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1));
  const byStatus = new Map<string, number>();
  devs.forEach((d) => byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1));
  const overdue = devs.filter((d) => d.preventive_state === "vencida").length;
  const soon = devs.filter((d) => d.preventive_state === "proxima").length;

  const rows = devs
    .map(
      (d) => `<tr><td><b>${d.name}</b><br/><span class="muted">${specSummary(d) || ""}</span></td><td>${d.asset_tag || "—"}<br/><span class="muted">${d.serial || ""}</span></td>
      <td>${DEVICE_KIND_MAP[d.kind]?.label ?? d.kind}</td><td>${d.sector || "—"}<br/><span class="muted">${d.client_name || ""}</span></td><td>${STATUS_LABEL[d.status] ?? d.status}</td>
      <td>${fmtDate(d.created_at)}</td><td>${d.last_preventive ? fmtDate(d.last_preventive) : "—"}<br/><span class="muted">${d.next_preventive ? `próx. ${fmtDate(d.next_preventive)}` : ""}</span></td><td class="r">${(byDevice.get(d.id) ?? []).length}</td></tr>`,
    )
    .join("");
  const names = new Map(devs.map((d) => [d.id, d.name]));
  const mrows = maint
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((m) => `<tr><td>${fmtDate(m.date)}</td><td>${names.get(m.device_id) ?? m.device_id}</td><td>${m.kind === "preventiva" ? "Preventiva" : "Corretiva"}</td><td>${m.description || ""}${m.parts ? `<br/><span class="muted">Peças: ${m.parts}</span>` : ""}</td><td>${m.technician || ""}</td><td class="r">${fmtBRL(Number(m.cost) || 0)}</td></tr>`)
    .join("");

  return `<html><head><meta charset="utf-8"/><style>${CSS}</style></head><body>
  ${docHeaderHtml()}
  <h1>Relatório de ativos</h1>
  <div class="sub">Cadastro: ${periodLabel(inp.created)} · Manutenções: ${periodLabel(inp.maint)}${inp.clientName ? ` · Cliente: ${inp.clientName}` : ""}${inp.kind ? ` · Tipo: ${DEVICE_KIND_MAP[inp.kind]?.label ?? inp.kind}` : ""} · Gerado em ${fmtDate(new Date().toISOString())}</div>
  <div class="kpis">
    <div class="kpi"><b>${devs.length}</b><span>Ativos</span></div>
    <div class="kpi"><b>${maint.length}</b><span>Manutenções</span></div>
    <div class="kpi"><b>${prev}</b><span>Preventivas</span></div>
    <div class="kpi"><b>${corr}</b><span>Corretivas</span></div>
    <div class="kpi"><b>${fmtBRL(cost)}</b><span>Custo total</span></div>
    <div class="kpi"><b>${overdue}</b><span>Prev. vencidas</span></div>
    <div class="kpi"><b>${soon}</b><span>Prev. próximas</span></div>
  </div>
  <h2>Totais por tipo e status</h2>
  <table><tr><th>Tipo</th><th class="r">Qtd</th><th style="width:40px;border:none;background:none"></th><th>Status</th><th class="r">Qtd</th></tr>
  ${Array.from({ length: Math.max(byKind.size, byStatus.size) })
    .map((_, i) => {
      const k = Array.from(byKind.entries())[i];
      const s = Array.from(byStatus.entries())[i];
      return `<tr><td>${k ? DEVICE_KIND_MAP[k[0]]?.label ?? k[0] : ""}</td><td class="r">${k ? k[1] : ""}</td><td style="border:none"></td><td>${s ? STATUS_LABEL[s[0]] ?? s[0] : ""}</td><td class="r">${s ? s[1] : ""}</td></tr>`;
    })
    .join("")}</table>
  <h2>Ativos (${devs.length})</h2>
  <table><tr><th>Dispositivo</th><th>Patrimônio / Série</th><th>Tipo</th><th>Setor / Cliente</th><th>Status</th><th>Cadastro</th><th>Preventiva</th><th class="r">Manut.</th></tr>
  ${rows || `<tr><td colspan="8" class="muted">Nenhum ativo no filtro</td></tr>`}</table>
  <h2>Manutenções no período (${maint.length})</h2>
  <table><tr><th>Data</th><th>Dispositivo</th><th>Tipo</th><th>Descrição</th><th>Técnico</th><th class="r">Custo</th></tr>
  ${mrows || `<tr><td colspan="6" class="muted">Nenhuma manutenção no período</td></tr>`}</table>
  <div class="foot">${currentCompany()} · Documento gerado eletronicamente</div>
  </body></html>`;
}

function statusHtml(s: Server) {
  return s.status === "online" ? `<span class="ok">ONLINE${s.latency_ms != null ? ` · ${s.latency_ms} ms` : ""}</span>` : s.status === "offline" ? `<span class="off">OFFLINE</span>` : `<span class="unk">Sem verificação</span>`;
}

export function serversReportHtml(servers: Server[], mode: "resumo" | "completo", clientName?: string) {
  const online = servers.filter((s) => s.status === "online").length;
  const offline = servers.filter((s) => s.status === "offline").length;
  const head = `${docHeaderHtml()}
  <h1>Relatório de servidores${mode === "resumo" ? " — resumo" : ""}</h1>
  <div class="sub">${servers.length} servidor(es)${clientName ? ` · Cliente: ${clientName}` : ""} · Gerado em ${fmtDate(new Date().toISOString())}</div>
  <div class="kpis"><div class="kpi"><b>${servers.length}</b><span>Total</span></div><div class="kpi"><b>${online}</b><span>Online</span></div><div class="kpi"><b>${offline}</b><span>Offline</span></div></div>`;

  if (mode === "resumo") {
    const rows = servers
      .map((s) => `<tr><td><b>${s.name}</b><br/><span class="muted">${s.role || ""}</span></td><td>${s.client_name || "—"}</td><td>${[s.city, s.state].filter(Boolean).join(" / ") || "—"}</td><td>${s.host}:${s.port}</td><td>${s.os || "—"}</td><td>${statusHtml(s)}</td><td>${s.last_check ? fmtDate(s.last_check) : "—"}</td></tr>`)
      .join("");
    return `<html><head><meta charset="utf-8"/><style>${CSS}</style></head><body>${head}
    <table><tr><th>Servidor</th><th>Cliente</th><th>Cidade/UF</th><th>Endereço</th><th>S.O.</th><th>Status</th><th>Última verificação</th></tr>${rows || `<tr><td colspan="7" class="muted">Nenhum servidor</td></tr>`}</table>
    <div class="foot">${currentCompany()} · Documento gerado eletronicamente</div></body></html>`;
  }

  const cards = servers
    .map((s) => {
      const m = s.metrics;
      return `<div class="card"><h3>${s.name} <span class="muted" style="font-weight:normal;font-size:11px">${s.role || ""}</span> · ${statusHtml(s)}</h3>
      <div class="grid">
        <div><b>Cliente:</b> ${s.client_name || "—"}</div><div><b>Local:</b> ${[s.city, s.state].filter(Boolean).join(" / ") || "—"}</div>
        <div><b>Endereço:</b> ${s.host}:${s.port}</div><div><b>Sistema:</b> ${s.os || m?.os || "—"}</div>
        <div><b>CPU:</b> ${s.cpu || "—"}</div><div><b>Memória:</b> ${s.ram || "—"}</div>
        <div><b>Disco:</b> ${s.disk || "—"}</div><div><b>Última verificação:</b> ${s.last_check ? new Date(s.last_check).toLocaleString("pt-BR") : "—"}</div>
        ${m ? `<div><b>Uso CPU:</b> ${m.cpu ?? "—"}%</div><div><b>Uso memória:</b> ${m.mem ?? "—"}%</div><div><b>Uso disco:</b> ${m.disk ?? "—"}%</div><div><b>Uptime:</b> ${m.uptime ?? "—"}</div>` : `<div class="muted" style="grid-column:1/3">Agente de monitoramento não instalado</div>`}
        ${s.notes ? `<div style="grid-column:1/3"><b>Observações:</b> ${s.notes}</div>` : ""}
      </div></div>`;
    })
    .join("");
  return `<html><head><meta charset="utf-8"/><style>${CSS}</style></head><body>${head}${cards || `<p class="muted">Nenhum servidor</p>`}
  <div class="foot">${currentCompany()} · Documento gerado eletronicamente</div></body></html>`;
}
