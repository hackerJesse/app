import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { currentCompany, currentLogo } from "@/src/brand";
import type { Client, Quote } from "@/src/types";
import { fmtBRL, quoteSubtotal, quoteTotal } from "@/src/types";

// Web: expo-print ignores `html` and prints the whole app page. Render the HTML in a hidden iframe and print only it.
function printHtmlWeb(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") return reject(new Error("Impressão indisponível"));
    const frame = document.createElement("iframe");
    frame.setAttribute("style", "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0");
    document.body.appendChild(frame);
    const cleanup = () => setTimeout(() => frame.remove(), 60000);
    const win = frame.contentWindow;
    if (!win) return reject(new Error("Impressão indisponível"));
    frame.onload = () => {
      try {
        win.focus();
        win.print();
        cleanup();
        resolve();
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    win.document.open();
    win.document.write(html);
    win.document.close();
  });
}

async function nativePdf(html: string, opts?: Print.FilePrintOptions) {
  const { uri } = await Print.printToFileAsync({ html, ...opts });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
  } else {
    await Print.printAsync({ uri });
  }
}

export async function printHtml(html: string) {
  if (Platform.OS === "web") {
    await printHtmlWeb(html);
    return;
  }
  try {
    await nativePdf(html);
  } catch {
    // Fallback: native print dialog straight from HTML.
    await Print.printAsync({ html });
  }
}

export const canSharePdf = true;

// Web: render HTML off-screen (iframe), rasterize with html2canvas and download a real PDF via jsPDF.
type PageMm = { w: number; h: number };
const A4: PageMm = { w: 210, h: 297 };
const LABEL_MM: PageMm = { w: 75, h: 45 };
const PX_PER_MM = 96 / 25.4;

async function webPdfDownload(html: string, fileName: string, page: PageMm) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const frame = document.createElement("iframe");
  const widthPx = Math.round(page.w * PX_PER_MM);
  frame.setAttribute("style", `position:fixed;left:-10000px;top:0;width:${widthPx}px;height:${Math.round(page.h * PX_PER_MM)}px;border:0;opacity:0`);
  document.body.appendChild(frame);
  try {
    const win = frame.contentWindow!;
    await new Promise<void>((res) => {
      frame.onload = () => res();
      win.document.open();
      win.document.write(html);
      win.document.close();
    });
    await new Promise((r) => setTimeout(r, 150)); // fonts/images settle
    const body = win.document.body;
    const canvas = await html2canvas(body, { scale: 3, useCORS: true, backgroundColor: "#ffffff", windowWidth: widthPx, width: widthPx, height: body.scrollHeight });
    const pdf = new jsPDF({ unit: "mm", format: [page.w, page.h], orientation: page.w > page.h ? "landscape" : "portrait" });
    const imgH = (canvas.height * page.w) / canvas.width;
    const pageH = page.h;
    const img = canvas.toDataURL("image/jpeg", 0.92);
    let y = 0;
    let first = true;
    while (y < imgH - 0.5) {
      if (!first) pdf.addPage([page.w, page.h], page.w > page.h ? "landscape" : "portrait");
      pdf.addImage(img, "JPEG", 0, -y, page.w, imgH);
      y += pageH;
      first = false;
    }
    pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
  } finally {
    frame.remove();
  }
}

export async function sharePdf(html: string, fileName: string, label = false) {
  if (Platform.OS === "web") {
    await webPdfDownload(html, fileName, label ? LABEL_MM : A4);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, ...(label ? LABEL_PAGE : {}) });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: fileName, UTI: "com.adobe.pdf" });
}

const STATUS_PT: Record<string, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente de aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  concluido: "Concluído",
};

export function quoteHtml(q: Quote, client?: Client) {
  const rows = q.items
    .map(
      (i, idx) => `<tr><td>${idx + 1}</td><td><b>${i.description}</b>${i.detail ? `<br/><span class="d">${i.detail}</span>` : ""}</td>
      <td class="r">${i.quantity}</td><td class="r">${fmtBRL(i.unit_price)}</td><td class="r">${fmtBRL(i.quantity * i.unit_price)}</td></tr>`,
    )
    .join("");
  const subtotal = quoteSubtotal(q);
  const total = quoteTotal(q);
  return `<html><head><meta charset="utf-8"/><style>
  body{font-family:Helvetica,Arial,sans-serif;color:#111;padding:28px;font-size:13px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #17A74A;padding-bottom:12px;margin-bottom:16px}
  .brand{font-size:20px;font-weight:bold;letter-spacing:1px}
  .meta{text-align:right;font-size:12px;color:#444}
  h2{font-size:16px;margin:16px 0 6px;color:#333;text-transform:uppercase;letter-spacing:1px}
  .box{border:1px solid #ddd;padding:10px;border-radius:4px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#1A1B20;color:#fff;text-align:left;padding:6px 8px;font-size:12px}
  td{border-bottom:1px solid #e5e5e5;padding:6px 8px;vertical-align:top}
  td.r,th.r{text-align:right}.d{color:#666;font-size:11px}
  .totals{margin-top:12px;margin-left:auto;width:260px}.totals td{border:none;padding:3px 8px}
  .totals tr.total td{font-size:16px;font-weight:bold;border-top:2px solid #111}
  .status{display:inline-block;padding:3px 8px;border:1px solid #17A74A;color:#0F6B32;border-radius:3px;font-size:11px;font-weight:bold;text-transform:uppercase}
  .notes{white-space:pre-wrap;color:#333}
  .foot{margin-top:40px;color:#888;font-size:10px;text-align:center}
  </style></head><body>
  <div class="top">
    <div style="display:flex;align-items:center;gap:12px">${currentLogo() ? `<img src="${currentLogo()}" style="height:52px;max-width:200px;object-fit:contain"/>` : ""}<div><div class="brand">${currentCompany()}</div><div style="color:#666;font-size:11px">Orçamento comercial</div></div></div>
    <div class="meta"><div style="font-size:18px;font-weight:bold">ORÇAMENTO ${q.number ?? ""}</div>
      <div>${q.kind === "servico" ? "Prestação de serviços" : "Venda de produtos"}</div>
      <div>Emitido em ${new Date(q.created_at ?? Date.now()).toLocaleDateString("pt-BR")}</div>
      ${q.valid_until ? `<div>Válido até ${q.valid_until}</div>` : ""}
      <div style="margin-top:6px"><span class="status">${STATUS_PT[q.status] ?? q.status}</span></div></div>
  </div>
  <h2>Cliente</h2>
  <div class="box"><b>${client?.name ?? q.client_name ?? "—"}</b>${client?.company ? ` · ${client.company}` : ""}
   ${client?.document ? `<br/>Documento: ${client.document}` : ""}${client?.email ? `<br/>E-mail: ${client.email}` : ""}${client?.phone ? ` · Tel: ${client.phone}` : ""}
   ${client?.address ? `<br/>${client.address}` : ""}</div>
  <h2>Itens</h2>
  <table><tr><th>#</th><th>Descrição</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Total</th></tr>${rows || `<tr><td colspan="5" style="color:#999">Sem itens</td></tr>`}</table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="r">${fmtBRL(subtotal)}</td></tr>
    ${q.discount ? `<tr><td>Desconto</td><td class="r">- ${fmtBRL(q.discount)}</td></tr>` : ""}
    ${q.tax ? `<tr><td>Impostos / taxas</td><td class="r">${fmtBRL(q.tax)}</td></tr>` : ""}
    <tr class="total"><td>TOTAL</td><td class="r">${fmtBRL(total)}</td></tr>
  </table>
  ${q.notes ? `<h2>Observações</h2><div class="box notes">${q.notes}</div>` : ""}
  <div class="foot">${currentCompany()} · Documento gerado eletronicamente</div>
  </body></html>`;
}

// Etiqueta 75mm x 45mm (Zebra GT / A4). Página do PDF já no tamanho da etiqueta, conteúdo no canto superior esquerdo.
export const LABEL_PAGE = { width: 213, height: 128, margins: { top: 0, left: 0, right: 0, bottom: 0 } };

export async function printLabel(html: string) {
  if (Platform.OS === "web") {
    await printHtmlWeb(html);
    return;
  }
  try {
    await nativePdf(html, LABEL_PAGE);
  } catch {
    await Print.printAsync({ html, ...LABEL_PAGE });
  }
}
