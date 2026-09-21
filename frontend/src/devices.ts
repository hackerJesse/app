import { currentCompany, currentLogo } from "@/src/brand";
import { qrSvg } from "@/src/qr";
import { fmtDate } from "@/src/types";

export function preventiveBadge(d: Device) {
  if (d.preventive_state === "vencida") return { text: `Preventiva vencida ${Math.abs(d.preventive_days_left ?? 0)}d`, tone: "error" as const };
  if (d.preventive_state === "proxima") return { text: `Preventiva em ${d.preventive_days_left}d`, tone: "warning" as const };
  if (d.preventive_state === "ok") return { text: `Preventiva ${fmtDate(d.next_preventive ?? undefined)}`, tone: "success" as const };
  return null;
}

export type Device = {
  id: string;
  name: string;
  kind: string;
  asset_tag?: string;
  serial?: string;
  brand?: string;
  model?: string;
  sector?: string;
  client_id?: string;
  client_name?: string;
  photo_path?: string;
  specs: Record<string, string>;
  preventive_months: number;
  last_preventive?: string;
  status: string;
  notes?: string;
  created_at?: string;
  next_preventive?: string | null;
  preventive_days_left?: number | null;
  preventive_state?: "vencida" | "proxima" | "ok" | "sem";
};

export type Maintenance = {
  id: string;
  device_id: string;
  kind: "preventiva" | "corretiva";
  date: string;
  description: string;
  technician?: string;
  cost: number;
  parts?: string;
  created_at?: string;
};

export type SpecField = { key: string; label: string; placeholder?: string };

export const DEVICE_KINDS: { value: string; label: string; icon: string; specs: SpecField[] }[] = [
  {
    value: "computador",
    label: "Computador",
    icon: "desktop-outline",
    specs: [
      { key: "cpu", label: "Processador", placeholder: "Intel i5-12400" },
      { key: "memory_size", label: "Memória (qtd)", placeholder: "16 GB" },
      { key: "memory_model", label: "Memória (modelo)", placeholder: "DDR4 3200" },
      { key: "memory_brand", label: "Memória (marca)", placeholder: "Kingston" },
      { key: "storage", label: "HD / SSD", placeholder: "SSD 480 GB Kingston" },
      { key: "gpu", label: "Placa de vídeo", placeholder: "Onboard / GTX 1650" },
      { key: "nic", label: "Placa de rede", placeholder: "Realtek 1Gb" },
      { key: "motherboard", label: "Placa-mãe", placeholder: "ASUS H610M" },
      { key: "monitor", label: "Monitor", placeholder: "LG 24'' " },
      { key: "keyboard", label: "Teclado / Mouse", placeholder: "Logitech MK120" },
      { key: "os", label: "Sistema operacional", placeholder: "Windows 11 Pro" },
    ],
  },
  {
    value: "notebook",
    label: "Notebook",
    icon: "laptop-outline",
    specs: [
      { key: "cpu", label: "Processador", placeholder: "Ryzen 5 5500U" },
      { key: "memory_size", label: "Memória", placeholder: "8 GB" },
      { key: "storage", label: "Tipo de HD / SSD", placeholder: "SSD NVMe 256 GB" },
      { key: "os", label: "Sistema operacional", placeholder: "Windows 11" },
    ],
  },
  {
    value: "servidor",
    label: "Servidor",
    icon: "server-outline",
    specs: [
      { key: "cpu", label: "Processador", placeholder: "Xeon E-2336" },
      { key: "memory_size", label: "Memória", placeholder: "64 GB ECC" },
      { key: "storage", label: "Armazenamento", placeholder: "2x 2TB RAID1" },
      { key: "os", label: "Sistema operacional", placeholder: "Windows Server 2022" },
      { key: "role", label: "Função", placeholder: "AD / Arquivos / ERP" },
    ],
  },
  { value: "tablet", label: "Tablet", icon: "tablet-portrait-outline", specs: [{ key: "config", label: "Configuração", placeholder: "128 GB, Android 14" }] },
  { value: "impressora", label: "Impressora", icon: "print-outline", specs: [{ key: "config", label: "Configuração", placeholder: "Laser mono, rede, duplex" }] },
  { value: "celular", label: "Celular", icon: "phone-portrait-outline", specs: [{ key: "config", label: "Configuração", placeholder: "128 GB, linha (11) 9..." }] },
  { value: "rede", label: "Equipamento de rede", icon: "wifi-outline", specs: [{ key: "config", label: "Configuração", placeholder: "Switch 24p PoE / AP" }] },
  { value: "outro", label: "Outro", icon: "cube-outline", specs: [{ key: "config", label: "Configuração", placeholder: "Descrição do equipamento" }] },
];

export const DEVICE_KIND_MAP = Object.fromEntries(DEVICE_KINDS.map((k) => [k.value, k]));

export const PREVENTIVE_OPTIONS = [
  { value: "0", label: "Sem preventiva" },
  { value: "1", label: "Mensal" },
  { value: "2", label: "A cada 2 meses" },
  { value: "3", label: "Trimestral (3 meses)" },
  { value: "4", label: "A cada 4 meses" },
  { value: "6", label: "Semestral (6 meses)" },
  { value: "12", label: "Anual (12 meses)" },
];

export const DEVICE_STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "manutencao", label: "Em manutenção" },
  { value: "reserva", label: "Reserva / estoque" },
  { value: "baixado", label: "Baixado" },
];

export function qrPayload(d: Device) {
  return `nsim:device:${d.id}`;
}

export function specSummary(d: Device) {
  const kind = DEVICE_KIND_MAP[d.kind];
  const parts: string[] = [];
  if (d.brand || d.model) parts.push([d.brand, d.model].filter(Boolean).join(" "));
  (kind?.specs ?? []).forEach((f) => {
    const v = d.specs?.[f.key];
    if (v) parts.push(`${f.label}: ${v}`);
  });
  return parts.join(" · ");
}

export function fmtDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 7,5cm x 4,5cm label. Text content on the left, QR on the right.
export function labelHtml(d: Device) {
  const logoDataUrl = currentLogo();
  const qr = qrSvg(qrPayload(d), 130);
  const printed = fmtDateTime(new Date().toISOString());
  const spec = specSummary(d);
  return `<html><head><meta charset="utf-8"/><style>
  @page { size: 75mm 45mm; margin: 0; }
  html,body{margin:0;padding:0;width:75mm;height:45mm}
  .label{position:absolute;top:0;left:0;width:75mm;height:45mm;box-sizing:border-box;padding:2.5mm 3mm;display:flex;flex-direction:column;font-family:Helvetica,Arial,sans-serif;color:#000;background:#fff;border:0.2mm dashed #999}
  .row{display:flex;flex:1;gap:2mm;min-height:0}
  .info{flex:1;display:flex;flex-direction:column;min-width:0}
  .tag{font-size:13pt;font-weight:bold;letter-spacing:0.5px;line-height:1.1}
  .name{font-size:8pt;font-weight:bold;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .line{font-size:7pt;margin-top:0.6mm;line-height:1.15}
  .spec{font-size:6pt;margin-top:1mm;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical}
  .qr{width:27mm;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .qr svg{width:26mm;height:26mm}
  .qrtxt{font-size:5pt;margin-top:0.5mm}
  .foot{display:flex;justify-content:space-between;align-items:center;font-size:5pt;color:#333;border-top:0.2mm solid #000;padding-top:0.6mm;margin-top:0.5mm}
  .foot img{height:3.5mm}
  </style></head><body>
  <div class="label">
    <div class="row">
      <div class="info">
        <div class="tag">${d.asset_tag ? `PAT. ${d.asset_tag}` : "SEM PATRIMÔNIO"}</div>
        <div class="name">${d.name}</div>
        <div class="line"><b>Setor:</b> ${d.sector || "—"}</div>
        ${d.serial ? `<div class="line"><b>N/S:</b> ${d.serial}</div>` : ""}
        <div class="spec">${spec || DEVICE_KIND_MAP[d.kind]?.label || ""}</div>
      </div>
      <div class="qr">${qr}<div class="qrtxt">${d.asset_tag || d.id.slice(0, 8)}</div></div>
    </div>
    <div class="foot"><span>${logoDataUrl ? `<img src="${logoDataUrl}"/>` : currentCompany()}</span><span>Impresso em ${printed}</span></div>
  </div>
  </body></html>`;
}
