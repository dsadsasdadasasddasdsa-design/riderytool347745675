// src/utils/cmcImageProcessor.js
import { getWordDimensions } from './cmcDimensions';
import imageCompression from 'browser-image-compression';

/**
 * Procesa un File de imagen para generar un blob/arrayBuffer
 * dimensionado al tamaño objetivo para docx. Usa createImageBitmap
 * y OffscreenCanvas cuando estén disponibles para mejor rendimiento.
 * Además aplica compresión previa con browser-image-compression.
 */
export const processImageForReport = async (imageFile, rotation = 0, orientation = 'horizontal') => {
  try {
    // Comprimir / reescalar ligero antes de decodificar para reducir memoria y tiempo
    const compressionOptions = {
      maxSizeMB: 1, // objetivo ~1MB (ajustable)
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      initialQuality: 0.9
    };

    let fileToProcess = imageFile;

    try {
      const compressedBlob = await imageCompression(imageFile, compressionOptions);
      // browser-image-compression puede devolver Blob
      if (compressedBlob instanceof Blob) {
        fileToProcess = new File([compressedBlob], imageFile.name, { type: compressedBlob.type });
      }
    } catch (compErr) {
      // Si falla la compresión, seguimos con el archivo original
      console.warn('imageCompression failed, continuing with original file', compErr);
    }

    // Target dims en pixeles (getWordDimensions ya devuelve pixeles)
    const targetDims = getWordDimensions(orientation);

    // Decode fast using createImageBitmap (si está disponible)
    const bitmap = await createImageBitmap(fileToProcess);
    const srcW = bitmap.width;
    const srcH = bitmap.height;

    // Factor de escalado: conservador para mantener calidad
    const scaleFactor = 2;

    const canvasWidth = Math.round(targetDims.width * scaleFactor);
    const canvasHeight = Math.round(targetDims.height * scaleFactor);

    // OffscreenCanvas si está disponible
    const canvas = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(canvasWidth, canvasHeight) : document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');

    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const isRotated = (rotation === 90 || rotation === 270);
    const effectiveSrcW = isRotated ? srcH : srcW;
    const effectiveSrcH = isRotated ? srcW : srcH;
    const scale = Math.min(canvasWidth / effectiveSrcW, canvasHeight / effectiveSrcH);

    const drawW = srcW * scale;
    const drawH = srcH * scale;

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Obtener blob (convertToBlob para OffscreenCanvas, toBlob para Canvas)
    let blob;
    if (canvas.convertToBlob) {
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    } else {
      blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
      });
    }

    if (!blob) throw new Error('Error generando imagen');

    const buffer = await blob.arrayBuffer();

    // Retornamos buffer y dimensiones objetivo (en pixeles) para docx ImageRun
    return { buffer, width: targetDims.width, height: targetDims.height };
  } catch (err) {
    console.error('processImageForReport error:', err);
    throw err;
  }
};
