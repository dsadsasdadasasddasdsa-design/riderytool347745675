import React from 'react';
import { Box, Typography } from '@mui/material';
import RecalculationGuide from './RecalculationGuide';
import CompactCalculator from './CompactCalculator';

/**
 * RecalculationPanel
 * - Panel único que se muestra cuando el usuario selecciona la pestaña RECÁLCULO (fuera de Conductor/Usuario).
 * - Este panel NO debe tener opción de generar reportes ni evidencias; solo guía y calculadora.
 * - Recibe isAdmin prop and forwards to RecalculationGuide to control edit visibility.
 */
export default function RecalculationPanel({ guideHtml = '', onSaveGuide = null, isAdmin = false }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ color: '#87fcd9', fontWeight: 900 }}>Recalculo (Panel)</Typography>

      <RecalculationGuide guideHtml={guideHtml} onSave={onSaveGuide} optionKey={'RECÁLCULO'} isAdmin={isAdmin} />

      <CompactCalculator mode="recalculo" values={{}} onChange={() => {}} />

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
        Este panel es únicamente para consulta y cálculo. No cargues evidencias ni generes reportes desde aquí.
      </Typography>
    </Box>
  );
}