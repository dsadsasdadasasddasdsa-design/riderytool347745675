// src/utils/cmcImageProcessor.js
// Procesa una File/Image y devuelve un objeto compatible con ReportGenerator:
// { buffer: ArrayBuffer, width: <px>, height: <px>, mime: 'image/png'|'image/jpeg' }
//
// Uso esperado: processImageForReport(file, rotation, orientation, targetDims)
// - file: File (from input)
// - rotation: degrees (0, 90, 180, 270)
// - orientation: 'horizontal'|'vertical' (informativo, no obligatorio)
// - targetDims: { width: <px>, height: <px> } tamaño objetivo para la imagen en el .docx
//
// Implementación: carga la imagen en ImageBitmap o Image, dibuja en canvas con el tamaño solicitado,
// aplica rotación si corresponde, obtiene blob y ArrayBuffer, devuelve buffer + dimensiones + mime.

export async function processImageForReport(file, rotation = 0, orientation = 'horizontal', targetDims = { width: 800, height: 600 }) {
  if (!file) throw new Error('No file provided to processImageForReport');

  // Helper: load image into ImageBitmap or HTMLImageElement fallback
  const loadImageBitmap = (file) => {
    return new Promise((resolve, reject) => {
      // Prefer createImageBitmap when available (faster, avoids tainting for same-origin)
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(file).then(resolve).catch(() => {
          // fallback to Image
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
          };
          img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
          img.src = url;
        });
      } else {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
      }
    });
  };

  const img = await loadImageBitmap(file);

  // Determine target width/height (px)
  const targetWidth = Math.max(1, Math.round(targetDims?.width || 800));
  const targetHeight = Math.max(1, Math.round(targetDims?.height || 600));

  // Create canvas sized to hold the rotated image with the target box
  // If rotation is 90 or 270, swap target dims for drawing
  const rot = ((rotation || 0) % 360 + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const canvasWidth = swap ? targetHeight : targetWidth;
  const canvasHeight = swap ? targetWidth : targetHeight;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  // Fill bg transparent (default)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Compute draw size preserving image aspect ratio inside target box
  // Fit the source image into target box (contain)
  const srcWidth = img.width || img.naturalWidth || targetWidth;
  const srcHeight = img.height || img.naturalHeight || targetHeight;

  // calculate scale to fit into targetDims while preserving aspect ratio
  const scale = Math.min(canvasWidth / srcWidth, canvasHeight / srcHeight);
  const drawW = Math.round(srcWidth * scale);
  const drawH = Math.round(srcHeight * scale);

  // center position
  const dx = Math.round((canvasWidth - drawW) / 2);
  const dy = Math.round((canvasHeight - drawH) / 2);

  // Apply rotation transform around canvas center if needed
  if (rot !== 0) {
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate((rot * Math.PI) / 180);
    // after rotate, draw at -drawW/2, -drawH/2
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  // Convert canvas to blob (prefer PNG for transparency if any; else JPEG)
  const mime = 'image/png';
  const blob = await new Promise((resolve) => {
    // quality ignored for PNG
    canvas.toBlob((b) => resolve(b), mime);
  });

  const arrayBuffer = await blob.arrayBuffer();

  return {
    buffer: arrayBuffer,
    width: canvas.width,
    height: canvas.height,
    mime: mime
  };
}