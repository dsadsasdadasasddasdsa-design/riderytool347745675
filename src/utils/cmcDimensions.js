// src/utils/cmcDimensions.js

// Factor de conversión cm -> pixels (referencia para docx transform)
const CM_TO_PIXELS = 37.7952755906;

const BASE_DIMS = {
  HORIZONTAL: { width: 11.0, height: 5.56 },
  VERTICAL: { width: 2.97, height: 6.17 }
};

/**
 * Devuelve dimensiones en PIXELES para ImageRun (docx).
 * orientation: 'horizontal' | 'vertical'
 */
export const getWordDimensions = (orientation = 'horizontal') => {
  const dims = orientation === 'horizontal' ? BASE_DIMS.HORIZONTAL : BASE_DIMS.VERTICAL;
  return {
    width: Math.round(dims.width * CM_TO_PIXELS),
    height: Math.round(dims.height * CM_TO_PIXELS)
  };
};
