'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  url: string;
  label: string;
  size?: number;
}

export default function QRCodeDisplay({ url, label, size = 200 }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { width: size, margin: 2, color: { dark: '#18181b', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(console.error);
  }, [url, size]);

  if (!dataUrl) return <div className="w-[200px] h-[200px] bg-zinc-100 animate-pulse rounded-lg" />;

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <img src={dataUrl} alt={`QR Code for ${label}`} width={size} height={size} className="rounded-lg border border-zinc-200" />
      <p className="text-xs text-zinc-500 max-w-[200px] text-center truncate">{url}</p>
      <a
        href={dataUrl}
        download={`qrcode-${label}.png`}
        className="text-xs text-zinc-600 underline hover:text-zinc-900"
      >
        下載 PNG
      </a>
    </div>
  );
}
