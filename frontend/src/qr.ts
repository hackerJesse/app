// Pure-JS QR generation using the core of the `qrcode` package (no Buffer needed).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCore = require("qrcode/lib/core/qrcode");

export type QrMatrix = { size: number; path: string };

// Returns an SVG path (unit = 1 module) that draws the dark modules.
export function qrPath(text: string): QrMatrix {
  const qr = QRCore.create(text, { errorCorrectionLevel: "M" });
  const size: number = qr.modules.size;
  const data: Uint8Array = qr.modules.data;
  let path = "";
  for (let r = 0; r < size; r++) {
    let run = 0;
    for (let c = 0; c <= size; c++) {
      const dark = c < size && data[r * size + c];
      if (dark) run++;
      else if (run) {
        path += `M${c - run} ${r}h${run}v1h-${run}z`;
        run = 0;
      }
    }
  }
  return { size, path };
}

export function qrSvg(text: string, px: number) {
  const { size, path } = qrPath(text);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
