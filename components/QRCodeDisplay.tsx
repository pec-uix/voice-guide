'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  url: string;
  label: string;
  title?: string;
  size?: number;
}

function drawCenterLabel(ctx: CanvasRenderingContext2D, title: string, size: number) {
  const boxW = size * 0.30;
  const boxH = size * 0.30;
  const bx = (size - boxW) / 2;
  const by = (size - boxH) / 2;
  const r = 6;
  const pad = 7;

  // White rounded background
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + boxW - r, by);
  ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  ctx.lineTo(bx + boxW, by + boxH - r);
  ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  ctx.lineTo(bx + r, by + boxH);
  ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.fill();

  const maxW = boxW - pad * 2;

  // Find a font size where the title fits in ≤3 lines
  let fontSize = 13;
  const fontFace = '"PingFang TC","Microsoft JhengHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const wrapLines = (fs: number): string[] => {
    ctx.font = `bold ${fs}px ${fontFace}`;
    const lines: string[] = [];
    let cur = '';
    for (const ch of title) {
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        lines.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  let lines = wrapLines(fontSize);
  while (lines.length > 3 && fontSize > 8) {
    fontSize--;
    lines = wrapLines(fontSize);
  }

  ctx.font = `bold ${fontSize}px ${fontFace}`;
  ctx.fillStyle = '#18181b';
  const lineH = fontSize * 1.35;
  const totalH = lines.length * lineH;
  const startY = size / 2 - totalH / 2 + lineH / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, size / 2, startY + i * lineH);
  });
}

export default function QRCodeDisplay({ url, label, title, size = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDataUrl(null);

    QRCode.toCanvas(canvas, url, {
      width: size,
      margin: 2,
      errorCorrectionLevel: title ? 'H' : 'M',
      color: { dark: '#18181b', light: '#ffffff' },
    })
      .then(() => {
        if (title) {
          const ctx = canvas.getContext('2d');
          if (ctx) drawCenterLabel(ctx, title, size);
        }
        setDataUrl(canvas.toDataURL('image/png'));
      })
      .catch(console.error);
  }, [url, size, title]);

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {dataUrl
        ? <img src={dataUrl} alt={`QR Code for ${label}`} width={size} height={size} className="rounded-lg border border-zinc-200" />
        : <div style={{ width: size, height: size }} className="bg-zinc-100 animate-pulse rounded-lg" />
      }
      <p className="text-xs text-zinc-500 max-w-[240px] text-center truncate">{url}</p>
      <a
        href={dataUrl ?? '#'}
        download={`qrcode-${label}.png`}
        className="text-xs text-zinc-600 underline hover:text-zinc-900"
      >
        下載 PNG
      </a>
    </div>
  );
}
