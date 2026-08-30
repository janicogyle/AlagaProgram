export function analyzeImageQualityPixels({ data, width, height, step = 2 }) {
  if (!data || !width || !height) {
    return { brightness: 0, contrast: 0, sharpness: 0, darkRatio: 0, brightRatio: 0 };
  }

  let sum = 0;
  let sumSquares = 0;
  let dark = 0;
  let bright = 0;
  let count = 0;
  const gray = new Float32Array(width * height);

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const value = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    gray[pixel] = value;
    sum += value;
    sumSquares += value * value;
    if (value < 45) dark += 1;
    if (value > 235) bright += 1;
    count += 1;
  }

  let edgeSum = 0;
  let edgeSumSquares = 0;
  let edgeCount = 0;
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const center = gray[y * width + x];
      const laplacian =
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x] +
        gray[y * width + x - 1] +
        gray[y * width + x + 1] -
        4 * center;
      edgeSum += laplacian;
      edgeSumSquares += laplacian * laplacian;
      edgeCount += 1;
    }
  }

  const mean = count ? sum / count : 0;
  const variance = count ? sumSquares / count - mean * mean : 0;
  const edgeMean = edgeCount ? edgeSum / edgeCount : 0;
  const sharpness = edgeCount ? edgeSumSquares / edgeCount - edgeMean * edgeMean : 0;

  return {
    brightness: Number(mean.toFixed(2)),
    contrast: Number(Math.sqrt(Math.max(0, variance)).toFixed(2)),
    sharpness: Number(Math.max(0, sharpness).toFixed(2)),
    darkRatio: Number((dark / Math.max(1, count)).toFixed(4)),
    brightRatio: Number((bright / Math.max(1, count)).toFixed(4)),
  };
}

export function getImageQualityIssue(metrics, {
  label = 'Image',
  minSharpness = 35,
  minBrightness = 55,
  maxBrightness = 215,
  minContrast = 18,
} = {}) {
  if (!metrics) return '';
  if (metrics.sharpness < minSharpness) {
    return `${label} appears blurry. Retake it with a steady camera and tap to focus.`;
  }
  if (metrics.brightness < minBrightness || metrics.darkRatio > 0.55) {
    return `${label} has poor lighting. Retake it in a brighter area with your face clearly visible.`;
  }
  if (metrics.brightness > maxBrightness || metrics.brightRatio > 0.4) {
    return `${label} is overexposed. Retake it away from direct glare or strong backlight.`;
  }
  if (metrics.contrast < minContrast) {
    return `${label} has low contrast. Retake it with better lighting and a clear background.`;
  }
  return '';
}
