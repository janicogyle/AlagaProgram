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

function drawCardDetail(ctx, label, value, y) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#173f94';
  ctx.font = '700 23px Arial, Helvetica, sans-serif';
  ctx.fillText(label, 144, y);

  ctx.font = '600 23px Arial, Helvetica, sans-serif';
  ctx.fillText(':', 266, y);
  ctx.fillText(truncateText(ctx, value, 220), 286, y);
}

export async function renderBeneficiaryIdCard({ qrUrl, fullName, sectorLabel, cardReference, contactNumber, expiresAt }) {
  const [logo, qrImage] = await Promise.all([loadCanvasImage('/Brand.png'), loadCanvasImage(qrUrl)]);
  const canvas = document.createElement('canvas');
  canvas.width = ID_CARD_WIDTH;
  canvas.height = ID_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT);

  ctx.fillStyle = '#173f94';
  ctx.fillRect(0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT);

  ctx.fillStyle = '#43b6e8';
  ctx.beginPath();
  ctx.moveTo(0, 93);
  ctx.bezierCurveTo(178, 132, 353, 50, ID_CARD_WIDTH, 92);
  ctx.lineTo(ID_CARD_WIDTH, 168);
  ctx.bezierCurveTo(365, 107, 175, 182, 0, 151);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 156);
  ctx.bezierCurveTo(180, 95, 407, 103, ID_CARD_WIDTH, 176);
  ctx.lineTo(ID_CARD_WIDTH, 838);
  ctx.bezierCurveTo(420, 882, 254, 925, 0, 854);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(17, 24, 39, 0.12)';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(-26, 262);
  ctx.bezierCurveTo(130, 136, 371, 147, 620, 235);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(17, 24, 39, 0.14)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(-20, 797);
  ctx.bezierCurveTo(158, 918, 402, 919, 620, 763);
  ctx.stroke();

  ctx.fillStyle = '#43b6e8';
  ctx.beginPath();
  ctx.moveTo(0, 842);
  ctx.bezierCurveTo(160, 909, 387, 898, ID_CARD_WIDTH, 824);
  ctx.lineTo(ID_CARD_WIDTH, 923);
  ctx.bezierCurveTo(383, 978, 159, 977, 0, 908);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#173f94';
  ctx.beginPath();
  ctx.moveTo(0, 902);
  ctx.bezierCurveTo(168, 971, 388, 972, ID_CARD_WIDTH, 914);
  ctx.lineTo(ID_CARD_WIDTH, ID_CARD_HEIGHT);
  ctx.lineTo(0, ID_CARD_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(53, 55, 43, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logo, 10, 12, 86, 86);
  ctx.restore();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(53, 55, 43, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff352';
  ctx.font = '800 25px Arial, Helvetica, sans-serif';
  ctx.fillText('BARANGAY STA. RITA - OLONGAPO CITY', 112, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px Arial, Helvetica, sans-serif';
  ctx.fillText('ALAGA Program', 112, 73);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(143, 278, 306, 306);
  ctx.drawImage(qrImage, 153, 288, 286, 286);

  drawFittedText(ctx, String(fullName || 'Beneficiary').toUpperCase(), ID_CARD_WIDTH / 2, 688, 452, {
    color: '#173f94',
    maxSize: 40,
    minSize: 25,
    weight: '800',
  });
  drawFittedText(ctx, String(sectorLabel || 'General').toUpperCase(), ID_CARD_WIDTH / 2, 727, 360, {
    color: '#173f94',
    maxSize: 23,
    minSize: 18,
    weight: '500',
  });

  drawCardDetail(ctx, 'CARD NO', cardReference || '-', 814);
  drawCardDetail(ctx, 'PHONE', contactNumber || '-', 854);
  drawCardDetail(ctx, 'EXPIRES', formatCardDate(expiresAt), 894);

  ctx.strokeStyle = 'rgba(23, 63, 148, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, ID_CARD_WIDTH - 12, ID_CARD_HEIGHT - 12);

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
