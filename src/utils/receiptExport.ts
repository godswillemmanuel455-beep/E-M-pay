import type { Transaction, UserProfile } from '../types/banking';

export type ReceiptThemeId = 'default' | 'chop-life' | 'urgent-2k' | 'christmas' | 'ramadan';

export interface ReceiptThemeConfig {
  id: ReceiptThemeId;
  label: string;
  accentHex: string;
  badgeText?: string;
  tintBg: string;
}

export const RECEIPT_THEMES: ReceiptThemeConfig[] = [
  {
    id: 'default',
    label: 'Default',
    accentHex: '#BA7E44',
    tintBg: '#FFFFFF',
  },
  {
    id: 'chop-life',
    label: 'Chop Life',
    accentHex: '#BA7E44',
    badgeText: 'CHOP LIFE',
    tintBg: '#FAF7F2',
  },
  {
    id: 'urgent-2k',
    label: 'Urgent 2k',
    accentHex: '#0F172A',
    badgeText: 'URGENT 2K',
    tintBg: '#F8FAFC',
  },
  {
    id: 'christmas',
    label: 'Christmas',
    accentHex: '#9C6230',
    badgeText: 'SEASON GREETINGS',
    tintBg: '#F5EBDD',
  },
  {
    id: 'ramadan',
    label: 'Ramadan',
    accentHex: '#7C4A1E',
    badgeText: 'EID & BLESSINGS',
    tintBg: '#FAF4EC',
  },
];

export function maskAccountNumber(acct: string): string {
  const digits = (acct || '').replace(/\D/g, '');
  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
  }
  return acct || '000****000';
}

export function formatReceiptParties(tx: Transaction, profile: UserProfile) {
  const isCredit = tx.type === 'credit';
  const bankLabel = tx.bankName.includes('FastDL') ? 'FastDL Bank' : tx.bankName;

  if (isCredit) {
    return {
      recipientName: profile.fullName.toUpperCase(),
      recipientSub: `FastDL Bank | ${maskAccountNumber(profile.accountNumber)}`,
      senderName: tx.counterparty.toUpperCase(),
      senderSub: `${bankLabel} | ${maskAccountNumber(tx.accountNumber)}`,
    };
  }

  return {
    recipientName: tx.counterparty.toUpperCase(),
    recipientSub: `${bankLabel} | ${maskAccountNumber(tx.accountNumber)}`,
    senderName: profile.fullName.toUpperCase(),
    senderSub: `FastDL Bank | ${maskAccountNumber(profile.accountNumber)}`,
  };
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export function renderReceiptCanvas(
  tx: Transaction,
  profile: UserProfile,
  themeId: ReceiptThemeId = 'default'
): HTMLCanvasElement {
  const theme = RECEIPT_THEMES.find((t) => t.id === themeId) ?? RECEIPT_THEMES[0];
  const width = 900;
  const height = 1160;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const padX = 56;
  const cardX = 36;
  const cardY = 36;
  const cardW = width - cardX * 2;
  const cardH = height - cardY * 2;

  // Outer soft background
  ctx.fillStyle = '#F5F6F8';
  ctx.fillRect(0, 0, width, height);

  // Card paper background
  ctx.fillStyle = theme.tintBg;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Scalloped perforated top & bottom edges
  ctx.fillStyle = '#F5F6F8';
  const notchRadius = 11;
  const step = 34;
  for (let x = cardX + 22; x < cardX + cardW - 10; x += step) {
    ctx.beginPath();
    ctx.arc(x, cardY, notchRadius, 0, Math.PI, false);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, cardY + cardH, notchRadius, Math.PI, Math.PI * 2, false);
    ctx.fill();
  }

  // Subtle diagonal watermark ("FastDL Bank")
  ctx.save();
  ctx.beginPath();
  ctx.rect(cardX, cardY, cardW, cardH);
  ctx.clip();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.045)';
  ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
  for (let y = cardY + 110; y < cardY + cardH; y += 220) {
    for (let x = cardX + 20; x < cardX + cardW; x += 310) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.34);
      ctx.fillText('FastDL Bank', 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();

  // Optional Theme Top Accent Strip
  if (theme.badgeText) {
    ctx.fillStyle = theme.accentHex;
    ctx.fillRect(cardX, cardY + 12, cardW, 10);
  }

  // Brand Emblem (Top-Left)
  const logoCenterX = cardX + padX + 24;
  const logoCenterY = cardY + 96;
  ctx.beginPath();
  ctx.arc(logoCenterX, logoCenterY, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#BA7E44';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(logoCenterX, logoCenterY, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  ctx.fillStyle = '#1D1B5B';
  ctx.font = '800 30px system-ui, -apple-system, sans-serif';
  ctx.fillText('FastDL Bank', logoCenterX + 36, logoCenterY + 10);

  // Header Right ("Transaction Receipt")
  ctx.fillStyle = '#1A1D23';
  ctx.font = '500 26px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Transaction Receipt', cardX + cardW - padX, logoCenterY + 9);

  if (theme.badgeText) {
    ctx.font = '700 16px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = theme.accentHex;
    ctx.fillText(theme.badgeText, cardX + cardW - padX, logoCenterY + 38);
  }

  // Centered Amount + Status + Date
  ctx.textAlign = 'center';
  const formattedAmount = `₦${tx.amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  ctx.fillStyle = '#BA7E44';
  ctx.font = '800 54px system-ui, -apple-system, sans-serif';
  ctx.fillText(formattedAmount, width / 2, cardY + 235);

  ctx.fillStyle = '#1A1D23';
  ctx.font = '600 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(tx.status, width / 2, cardY + 286);

  ctx.fillStyle = '#6B7280';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(tx.timestamp, width / 2, cardY + 328);

  // Divider
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + padX, cardY + 362);
  ctx.lineTo(cardX + cardW - padX, cardY + 362);
  ctx.stroke();

  // Key-value rows
  const parties = formatReceiptParties(tx, profile);
  const leftX = cardX + padX;
  const rightX = cardX + cardW - padX;
  let y = cardY + 422;

  const drawRow = (label: string, primary: string, secondary?: string) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6B7280';
    ctx.font = '500 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, leftX, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#1A1D23';
    ctx.font = '700 25px system-ui, -apple-system, sans-serif';
    const wrapped = wrapLines(ctx, primary, 430);
    wrapped.forEach((line, idx) => {
      ctx.fillText(line, rightX, y + idx * 34);
    });
    const afterPrimaryY = y + (wrapped.length - 1) * 34;
    if (secondary) {
      ctx.fillStyle = '#4B5563';
      ctx.font = '500 23px system-ui, -apple-system, sans-serif';
      ctx.fillText(secondary, rightX, afterPrimaryY + 36);
      y = afterPrimaryY + 96;
    } else {
      y = afterPrimaryY + 68;
    }
  };

  drawRow('Recipient Details', parties.recipientName, parties.recipientSub);
  drawRow('Sender Details', parties.senderName, parties.senderSub);
  drawRow('Transaction No.', tx.reference);
  if (tx.note) {
    drawRow('Remark', tx.note);
  }

  // Footer Disclaimer
  const footerY = Math.max(y + 42, cardY + cardH - 250);
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftX, footerY - 34);
  ctx.lineTo(rightX, footerY - 34);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#6B7280';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  const disclaimer =
    'Enjoy a better life with E&M Pay. Get free transfers, withdrawals, bill payments, instant loans, and good annual interest on your savings. E&M Pay Digital Services keeps every transaction fast and secure.';
  const footerLines = wrapLines(ctx, disclaimer, cardW - padX * 2);
  footerLines.forEach((line, idx) => {
    ctx.fillText(line, leftX, footerY + idx * 34);
  });

  return canvas;
}

export async function generateReceiptPngBlob(
  tx: Transaction,
  profile: UserProfile,
  themeId: ReceiptThemeId = 'default'
): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = renderReceiptCanvas(tx, profile, themeId);
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Unable to generate receipt PNG'));
    }, 'image/png');
  });
  return { blob, dataUrl };
}

export function generateReceiptPdfBlob(
  tx: Transaction,
  profile: UserProfile,
  themeId: ReceiptThemeId = 'default'
): Blob {
  const canvas = renderReceiptCanvas(tx, profile, themeId);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const base64 = jpegDataUrl.split(',')[1] ?? '';
  const binaryStr = atob(base64);
  const jpegBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    jpegBytes[i] = binaryStr.charCodeAt(i);
  }

  const pageW = 595;
  const pageH = 842;
  const imgMargin = 28;
  const drawW = pageW - imgMargin * 2;
  const drawH = (canvas.height / canvas.width) * drawW;
  const drawY = (pageH - drawH) / 2;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;

  const pushStr = (s: string) => {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    cursor += bytes.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    cursor += b.length;
  };

  pushStr('%PDF-1.4\n');

  offsets[1] = cursor;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = cursor;
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = cursor;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  offsets[4] = cursor;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  const contentStream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${imgMargin.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  offsets[5] = cursor;
  pushStr(
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
  );

  const xrefOffset = cursor;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([out], { type: 'application/pdf' });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
