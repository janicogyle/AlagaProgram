export const ID_CARD_WIDTH = 591;
export const ID_CARD_HEIGHT = 1004;
export const ID_CARD_WIDTH_MM = 50;
export const ID_CARD_HEIGHT_MM = 85;

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    img.src = src;
  });
}

export function formatCardDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
}

function truncateText(ctx, text, maxWidth) {
  const value = String(text || '').trim();
  if (!value) return '-';
  if (ctx.measureText(value).width <= maxWidth) return value;

  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }

  return `${next.trim()}...`;
}

function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const value = String(text || '').trim();
  if (!value) return ['-'];

  const words = value.split(/\s+/);
  const lines = [];
  let current = '';

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (lines.length === maxLines - 1) {
      const remaining = words.slice(index).join(' ');
      current = truncateText(ctx, current ? `${current} ${remaining}` : remaining, maxWidth);
      break;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current && lines.length < maxLines) lines.push(current);

  return lines.length ? lines.map((line) => truncateText(ctx, line, maxWidth)) : ['-'];
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFittedText(ctx, text, x, y, maxWidth, options = {}) {
  const {
    align = 'center',
    baseline = 'alphabetic',
    color = '#173f94',
    family = 'Arial, Helvetica, sans-serif',
    maxSize = 42,
    minSize = 24,
    weight = '700',
  } = options;

  let size = maxSize;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;

  while (size > minSize && ctx.measureText(String(text || '')).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${family}`;
  }

  ctx.fillText(truncateText(ctx, text, maxWidth), x, y);
}

function drawLineIcon(ctx, type, x, y) {
  ctx.save();
  ctx.strokeStyle = '#5da8d6';
  ctx.fillStyle = '#5da8d6';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'card') {
    roundedRect(ctx, x, y - 13, 31, 24, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 4);
    ctx.lineTo(x + 14, y - 4);
    ctx.moveTo(x + 6, y + 4);
    ctx.lineTo(x + 24, y + 4);
    ctx.moveTo(x + 20, y - 7);
    ctx.lineTo(x + 25, y - 7);
    ctx.stroke();
  } else if (type === 'phone') {
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 14);
    ctx.bezierCurveTo(x + 2, y - 8, x + 3, y + 9, x + 21, y + 16);
    ctx.lineTo(x + 28, y + 9);
    ctx.lineTo(x + 20, y + 3);
    ctx.lineTo(x + 15, y + 8);
    ctx.bezierCurveTo(x + 10, y + 4, x + 8, y - 1, x + 10, y - 6);
    ctx.lineTo(x + 16, y - 10);
    ctx.closePath();
    ctx.stroke();
  } else if (type === 'pin') {
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 16);
    ctx.bezierCurveTo(x + 1, y, x + 3, y - 18, x + 16, y - 18);
    ctx.bezierCurveTo(x + 29, y - 18, x + 31, y, x + 16, y + 16);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 16, y - 5, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'calendar') {
    roundedRect(ctx, x + 1, y - 15, 31, 28, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 6);
    ctx.lineTo(x + 32, y - 6);
    ctx.moveTo(x + 9, y - 20);
    ctx.lineTo(x + 9, y - 11);
    ctx.moveTo(x + 24, y - 20);
    ctx.lineTo(x + 24, y - 11);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCardDetail(ctx, { icon, label, value, y, maxLines = 1 }) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  drawLineIcon(ctx, icon, 79, y);

  ctx.fillStyle = '#475569';
  ctx.font = '600 24px Arial, Helvetica, sans-serif';
  ctx.fillText(label, 127, y);

  ctx.fillStyle = '#17233c';
  ctx.font = '800 23px Arial, Helvetica, sans-serif';
  const valueX = 292;
  const maxWidth = 222;
  if (maxLines > 1) {
    const lines = wrapText(ctx, value, maxWidth, maxLines);
    const startY = y - ((lines.length - 1) * 16);
    lines.forEach((line, index) => {
      ctx.fillText(line, valueX, startY + index * 31);
    });
  } else {
    ctx.fillText(truncateText(ctx, value, maxWidth), valueX, y);
  }
}

export async function renderBeneficiaryIdCard({
  qrUrl,
  fullName,
  sectorLabel,
  cardReference,
  contactNumber,
  address,
  issuedAt,
  expiresAt,
}) {
  void issuedAt;
  const [logo, qrImage] = await Promise.all([loadCanvasImage('/Brand.png'), loadCanvasImage(qrUrl)]);
  const canvas = document.createElement('canvas');
  canvas.width = ID_CARD_WIDTH;
  canvas.height = ID_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT);
  ctx.save();
  roundedRect(ctx, 0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT, 22);
  ctx.clip();

  ctx.fillStyle = '#f8fbff';
  ctx.fillRect(0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT);

  ctx.fillStyle = '#0b5ba8';
  ctx.fillRect(0, 0, ID_CARD_WIDTH, 178);

  ctx.fillStyle = '#eaf5ff';
  ctx.beginPath();
  ctx.moveTo(0, 146);
  ctx.bezierCurveTo(140, 119, 271, 117, ID_CARD_WIDTH, 154);
  ctx.lineTo(ID_CARD_WIDTH, 220);
  ctx.bezierCurveTo(404, 177, 210, 164, 0, 214);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#bfe5fb';
  ctx.beginPath();
  ctx.moveTo(0, 160);
  ctx.bezierCurveTo(160, 126, 321, 149, ID_CARD_WIDTH, 138);
  ctx.lineTo(ID_CARD_WIDTH, 184);
  ctx.bezierCurveTo(390, 172, 204, 198, 0, 181);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 194);
  ctx.bezierCurveTo(146, 134, 360, 151, ID_CARD_WIDTH, 196);
  ctx.lineTo(ID_CARD_WIDTH, 821);
  ctx.bezierCurveTo(390, 861, 222, 880, 0, 820);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#d7effd';
  ctx.beginPath();
  ctx.moveTo(0, 790);
  ctx.bezierCurveTo(190, 848, 378, 858, ID_CARD_WIDTH, 780);
  ctx.lineTo(ID_CARD_WIDTH, 857);
  ctx.bezierCurveTo(415, 914, 170, 907, 0, 842);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0b5ba8';
  ctx.beginPath();
  ctx.moveTo(0, 842);
  ctx.bezierCurveTo(177, 911, 405, 909, ID_CARD_WIDTH, 838);
  ctx.lineTo(ID_CARD_WIDTH, ID_CARD_HEIGHT);
  ctx.lineTo(0, ID_CARD_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(78, 70, 48, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logo, 30, 22, 96, 96);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(78, 70, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 27px Arial, Helvetica, sans-serif';
  ctx.fillText('BARANGAY STA. RITA', 347, 55);
  ctx.font = '800 27px Arial, Helvetica, sans-serif';
  ctx.fillText('OLONGAPO CITY', 347, 88);
  ctx.font = '700 21px Arial, Helvetica, sans-serif';
  ctx.fillText('ALAGA PROGRAM', 347, 121);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(143, 211, 306, 306);
  ctx.drawImage(qrImage, 153, 221, 286, 286);

  drawFittedText(ctx, String(fullName || 'Beneficiary').toUpperCase(), ID_CARD_WIDTH / 2, 579, 445, {
    color: '#0b5ba8',
    maxSize: 38,
    minSize: 24,
    weight: '800',
  });

  const sectorText = truncateText(ctx, String(sectorLabel || 'General').toUpperCase(), 145);
  ctx.font = '700 21px Arial, Helvetica, sans-serif';
  const pillWidth = Math.max(72, ctx.measureText(sectorText).width + 34);
  roundedRect(ctx, (ID_CARD_WIDTH - pillWidth) / 2, 604, pillWidth, 38, 19);
  ctx.fillStyle = '#5b86db';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sectorText, ID_CARD_WIDTH / 2, 623);

  const normalizedAddress = String(address || '').trim() || '-';
  drawCardDetail(ctx, { icon: 'card', label: 'Card No.', value: cardReference || '-', y: 682 });
  drawCardDetail(ctx, { icon: 'phone', label: 'Phone', value: contactNumber || '-', y: 733 });
  drawCardDetail(ctx, { icon: 'pin', label: 'Address', value: normalizedAddress, y: 792, maxLines: 2 });
  drawCardDetail(ctx, { icon: 'calendar', label: 'Expires', value: formatCardDate(expiresAt), y: 855 });

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 19px Arial, Helvetica, sans-serif';
  ctx.fillText('This card is non-transferable and valid only for', ID_CARD_WIDTH / 2, 938);
  ctx.fillText('ALAGA Program benefits.', ID_CARD_WIDTH / 2, 966);

  ctx.restore();

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.lineWidth = 2;
  roundedRect(ctx, 1, 1, ID_CARD_WIDTH - 2, ID_CARD_HEIGHT - 2, 22);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export function openBeneficiaryIdPrintWindow(cardImageUrl) {
  if (!cardImageUrl) return false;
  const printWindow = window.open('', '_blank', 'width=420,height=720');
  if (!printWindow) return false;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>ALAGA Beneficiary ID</title>
        <style>
          @page { size: ${ID_CARD_WIDTH_MM}mm ${ID_CARD_HEIGHT_MM}mm; margin: 0; }
          html, body {
            width: ${ID_CARD_WIDTH_MM}mm;
            height: ${ID_CARD_HEIGHT_MM}mm;
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          img {
            display: block;
            width: ${ID_CARD_WIDTH_MM}mm;
            height: ${ID_CARD_HEIGHT_MM}mm;
          }
        </style>
      </head>
      <body>
        <img src="${cardImageUrl}" alt="ALAGA Beneficiary ID" />
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 250);
  return true;
}
