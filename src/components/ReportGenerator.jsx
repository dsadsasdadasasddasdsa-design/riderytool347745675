// src/components/ReportGenerator.jsx
// ReportGenerator completo - con detección y propagación del estado de admin (isAdmin)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Document, Packer, Paragraph, ImageRun, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle
} from 'docx';
import { saveAs } from 'file-saver';
import {
  Container, Button, Grid, Typography, Box, Paper, Chip,
  LinearProgress, Snackbar, Alert
} from '@mui/material';
import ImageSlot from './ImageSlot';
import { processImageForReport } from '../utils/cmcImageProcessor';
import { getDimensionsFor, CM_TO_TWIPS } from '../utils/cmcDimensions';
import CompactCalculator from './CompactCalculator';
import RecalculationGuide from './RecalculationGuide';
import RecalculationPanel from './RecalculationPanel';
import CategoryPanel from './CategoryPanel';
import { nanoid } from 'nanoid';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { motion, AnimatePresence } from 'framer-motion';
import pLimit from 'p-limit';

const createNewSlot = (title = 'Evidencia Adicional') => ({
  id: nanoid(), file: null, title: title, rotation: 0, orientation: 'horizontal', size: 'normal'
});

const FONT_SIZE = 18;
const BORDER_COLOR = 'E0E0E0';
const CONCURRENCY_LIMIT = 3;

/**
 * generateImageTableForGroup
 * - slots: array de slots que comparten orientation y tamaño (size)
 * - cols: número de columnas que queremos usar (3,2,1)
 * - docChildren: array donde empujamos la tabla
 * - onProgress: callback opcional
 */
const generateImageTableForGroup = async (slots, cols, docChildren, onProgress) => {
  if (!slots || slots.length === 0) return;
  const limit = pLimit(CONCURRENCY_LIMIT);

  // Procesar cada imagen (con concurrencia)
  const processed = await Promise.all(
    slots.map((s) =>
      limit(async () => {
        const dims = getDimensionsFor(s.size || 'normal', s.orientation || 'horizontal', 1);
        const targetDims = { width: dims.width, height: dims.height }; // px para processImageForReport
        const result = await processImageForReport(s.file, s.rotation || 0, s.orientation || 'horizontal', targetDims);
        if (onProgress) onProgress();
        return { slot: s, result, dims };
      })
    )
  );

  if (processed.length === 0) return;

  const rows = [];
  let currentCells = [];

  // Derivamos ancho célula (twips) a partir del first processed dims.widthCm
  const firstWidthCm = processed[0]?.dims?.widthCm || 10;
  const cellWidthTwips = Math.round(firstWidthCm * CM_TO_TWIPS);
  const tableWidthTwips = cellWidthTwips * cols;

  for (let i = 0; i < processed.length; i++) {
    const { slot, result } = processed[i];
    const imageType = (result.mime && result.mime.toLowerCase().includes('png')) ? 'png' : 'jpeg';

    const titleParagraph = new Paragraph({
      children: [new TextRun({ text: slot.title || 'Evidencia', bold: true, size: FONT_SIZE, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 }
    });

    const imageParagraph = new Paragraph({
      children: [new ImageRun({ data: result.buffer, transformation: { width: result.width, height: result.height }, type: imageType })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 }
    });

    const cell = new TableCell({
      children: [titleParagraph, imageParagraph],
      width: { size: cellWidthTwips, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR }
      }
    });

    currentCells.push(cell);

    if (currentCells.length === cols) {
      rows.push(new TableRow({ children: currentCells }));
      currentCells = [];
    }
  }

  if (currentCells.length > 0) {
    while (currentCells.length < cols) {
      currentCells.push(new TableCell({
        children: [],
        width: { size: cellWidthTwips, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL } }
      }));
    }
    rows.push(new TableRow({ children: currentCells }));
  }

  const imageTable = new Table({
    rows,
    width: { size: tableWidthTwips, type: WidthType.DXA }
  });

  docChildren.push(imageTable);
  // pequeño espaciado para separar grupos
  docChildren.push(new Paragraph({ text: '', spacing: { after: 80 } }));
};

export default function ReportGenerator({ currentOption }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const slotsEndRef = useRef(null);

  const [snackOpen, setSnackOpen] = useState(false);

  const [calcState, setCalcState] = useState({
    amountAdmin: 0,
    cashGiven: 0,
    amountReal: 0,
    surgeAdmin: 1,
    surgeReal: 1,
    surgeType: 'none',
    cashGivenAdmin: 0,
    realCashGiven: 0
  });

  // 1. Detección y manejo del estado de administrador (isAdmin)
  const [isAdmin, setIsAdmin] = useState(() => !!localStorage.getItem('cmc_is_admin'));
  useEffect(() => {
    const onStorage = () => setIsAdmin(!!localStorage.getItem('cmc_is_admin'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  // Fin de Detección Admin

  // Guías por defecto (simplificadas). Se pueden editar en UI.
  const defaultGuides = {
    "CAMBIO DE MONTO CASH": `
      <h2>Cambio de Monto Cash</h2>
      <p>Se utiliza para corregir un error de validación del efectivo. Permite ajustar el monto que la aplicación descontará cuando el efectivo recibido no coincide con el monto que se registró en la app (generalmente porque se validó un monto mayor al real).</p>
      <p>Adicionalmente, se usa si el conductor realizó un cobro adicional por fuera de la app que debe ser descontado (casos comunes).</p>
    `,
    "INCIDENCIA VIAJE REALIZADO CASH": `
      <h2>Incidencia Viaje Realizado Cash</h2>
      <p>Se usa cuando, por diferentes razones, el viaje está en estatus <strong>cancelled</strong> pero el servicio sí se prestó y se pagó en efectivo. IMPORTANTE: un viaje cancelado hecho en efectivo jamás se puede revivir.</p>
    `,
    "INCIDENCIA MOVIMIENTO CERO": `
      <h2>Incidencia Movimiento Cero</h2>
      <p>Se realiza cuando el conductor valida que recibió efectivo, pero en realidad no recibió nada ($0). Esta incidencia anula el cobro al conductor.</p>
    `,
    "INCIDENCIA VIAJE REALIZADO": `
      <h2>Incidencia Viaje Realizado</h2>
      <p>Se crea cuando, por algún motivo, el viaje no se puede revivir (promocode, error admin, etc.).</p>
    `,
    "VIAJE YUNO": `<h2>Viajes Pago YUNO</h2><p>Incidencias por cobros no generados en YUNO.</p>`,
    "ABONO CXC PAGO MÓVIL": `<h2>Abono CXC (Pago móvil)</h2><p>Incidencia para pagos móviles abonados incorrectamente.</p>`
  };

  const [guideMap, setGuideMap] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cmc_guides') || '{}');
      return { ...defaultGuides, ...saved };
    } catch (e) {
      return { ...defaultGuides };
    }
  });

  useEffect(() => {
    const requiredItems = currentOption?.items || [];
    let initialSlots = requiredItems.map(itemTitle => createNewSlot(itemTitle));
    if (initialSlots.length === 0) initialSlots.push(createNewSlot('Evidencia Principal'));
    setSlots(initialSlots);
    setSnackOpen(false);
    setCalcState({
      amountAdmin: 0,
      cashGiven: 0,
      amountReal: 0,
      surgeAdmin: 1,
      surgeReal: 1,
      surgeType: 'none',
      cashGivenAdmin: 0,
      realCashGiven: 0
    });
  }, [currentOption]);

  const saveGuidesToStorage = (newMap) => {
    try {
      localStorage.setItem('cmc_guides', JSON.stringify(newMap));
    } catch (e) {
      console.warn('No se pudo guardar guías en localStorage', e);
    }
  };

  const handleGuideSave = (optionKey, newHtml) => {
    setGuideMap(prev => {
      const next = { ...prev, [optionKey]: newHtml };
      saveGuidesToStorage(next);
      return next;
    });
  };

  const handleAddSlot = useCallback(() => setSlots(prev => [...prev, createNewSlot('Nueva Evidencia')]), []);
  const handleSlotChange = useCallback((u) => setSlots(p => p.map(s => s.id === u.id ? { ...u } : s)), []);
  const handleSlotDelete = useCallback((id) => {
    setSlots(prev => {
      if (prev.length === 1) return [createNewSlot('Evidencia Principal')];
      return prev.filter(s => s.id !== id);
    });
  }, []);

  // Extrae ticket desde slots (title o file.name)
  const extractTicketFromSlots = (slotList) => {
    const ticketRegex = /#\d+/;
    for (const s of slotList) {
      if (s.title) {
        const m = String(s.title).match(ticketRegex);
        if (m) return m[0];
      }
      if (s.file && s.file.name) {
        const m2 = String(s.file.name).match(ticketRegex);
        if (m2) return m2[0];
      }
    }
    return null;
  };

  const handleGenerateWord = async () => {
    const validSlots = slots.filter(s => s.file);
    if (validSlots.length === 0) { alert('Sube al menos una imagen.'); return; }

    setLoading(true);
    setProcessedCount(0);
    setTotalToProcess(validSlots.length);

    try {
      const docChildren = [];

      // Título central
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: 'REPORTE CMC', bold: true, size: 28, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 }
      }));

      // Caso y ticket
      if (currentOption) {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: `CASO: ${currentOption.name}`, bold: true, size: 24, font: 'Calibri' })],
          spacing: { after: 60 }
        }));
        const ticket = extractTicketFromSlots(validSlots);
        if (ticket) {
          docChildren.push(new Paragraph({
            children: [new TextRun({ text: `TICKET: ${ticket}`, bold: false, size: 22, font: 'Calibri' })],
            spacing: { after: 120 }
          }));
        }
      }

      // Agrupar por orientación y tamaño
      const horizontalSlots = validSlots.filter(s => (s.orientation || 'horizontal') === 'horizontal');
      const verticalSlots = validSlots.filter(s => (s.orientation || 'horizontal') === 'vertical');

      const groupAndProcess = async (arr, onProgress) => {
        const bySize = { normal: [], mediana: [], grande: [] };
        arr.forEach(s => bySize[s.size || 'normal'].push(s));

        if (bySize.normal.length) await generateImageTableForGroup(bySize.normal, 3, docChildren, onProgress);
        if (bySize.mediana.length) await generateImageTableForGroup(bySize.mediana, 2, docChildren, onProgress);
        if (bySize.grande.length) await generateImageTableForGroup(bySize.grande, 1, docChildren, onProgress);
      };

      const onProgress = () => setProcessedCount(p => p + 1);

      if (horizontalSlots.length > 0) await groupAndProcess(horizontalSlots, onProgress);
      if (verticalSlots.length > 0) await groupAndProcess(verticalSlots, onProgress);

      const doc = new Document({
        sections: [{
          children: docChildren,
          properties: {
            page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } }
          }
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Reporte_CMC_${Date.now()}.docx`);

      setSnackOpen(true);
    } catch (error) {
      console.error(error);
      alert('Error al generar reporte.');
    } finally {
      setLoading(false);
      setTotalToProcess(0);
      setProcessedCount(0);
    }
  };

  const progressValue = totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  // Detectar panels top-level
  const currentCategory = currentOption?.category || '';
  const isRecalculoPanel = currentCategory === 'RECALCULO';
  const isCategoryPanel = currentCategory === 'CATEGORIAS';

  const optionName = (currentOption?.name || '').toUpperCase();
  const showCalculator = ['VIAJE REALIZADO CASH', 'VIAJE REALIZADO', 'VIAJE YUNO', 'RECÁLCULO', 'RECALCULO', 'CAMBIO DE MONTO CASH (CMC)', 'MOVIMIENTO CERO'].includes(optionName);
  const calculatorMode = optionName === 'VIAJE REALIZADO CASH'
    ? 'cash'
    : (optionName === 'RECÁLCULO' || optionName === 'RECALCULO' ? 'recalculo' : (optionName === 'CAMBIO DE MONTO CASH (CMC)' ? 'cambio' : (optionName === 'MOVIMIENTO CERO' ? 'mvzero' : 'noncash')));

  // lookup guide
  const guideKey = Object.keys(guideMap).find(k => optionName.includes(k.toUpperCase())) || null;
  const guideHtml = guideKey ? guideMap[guideKey] : '';

  return (
    <Container maxWidth="xl" sx={{ pb: 15 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 800 }}>{currentOption?.name}</Typography>
          <Chip label={currentOption?.category} sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#87fcd9', fontWeight: 'bold' }} />
        </Box>
      </motion.div>

      <Snackbar open={snackOpen} autoHideDuration={8000} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setSnackOpen(false)} severity="success" sx={{ width: '100%', bgcolor: '#3536ba', color: 'white' }}>
          <strong>✅ Reporte descargado</strong> — Para obtener el mejor PDF: abre el .docx en Word y use Archivo → Exportar para guardar en PDF de alta calidad.
        </Alert>
      </Snackbar>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {currentOption?.warning && (
              <Paper sx={{ bgcolor: 'rgba(255, 55, 117, 0.15)', border: '1px solid #ff3775', p: 2, borderRadius: '16px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#ff3775', mb: 1 }}>
                  <WarningAmberIcon /><Typography variant="h6">Atención</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#ffc1e3' }}>{currentOption.warning}</Typography>
              </Paper>
            )}

            {/* Paneles especiales - IMPORTANTE: Se propaga el estado isAdmin */}
            {isRecalculoPanel ? (
              <RecalculationPanel 
                guideHtml={guideMap['RECÁLCULO'] || guideMap['RECALCULO'] || ''} 
                onSaveGuide={handleGuideSave} 
                isAdmin={isAdmin} // <-- Propagado
              />
            ) : isCategoryPanel ? (
              <CategoryPanel 
                currentOptionName={currentOption?.name || ''} 
                onSave={handleGuideSave} 
                isAdmin={isAdmin} // <-- Propagado
              />
            ) : (
              guideKey && (
                <RecalculationGuide 
                  guideHtml={guideHtml} 
                  onSave={handleGuideSave} 
                  optionKey={guideKey} 
                  isAdmin={isAdmin} // <-- Propagado
                />
              )
            )}

            {/* Calculadora para incidencias normales (no para paneles top-level) */}
            {!isRecalculoPanel && !isCategoryPanel && showCalculator && (
              <CompactCalculator
                mode={calculatorMode}
                values={calcState}
                onChange={(partial) => setCalcState(s => ({ ...s, ...partial }))}
              />
            )}

            {/* REQUISITOS: solo mostrar para incidencias normales (no en RECALCULO panel) */}
            {!isRecalculoPanel && currentOption?.items && (
              <Paper sx={{ p: 2, bgcolor: 'rgba(20, 20, 40, 0.6)', border: '1px solid rgba(135, 252, 217, 0.2)', borderRadius: '16px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                  <AssignmentIcon sx={{ color: '#87fcd9' }} />
                  <Typography variant="subtitle1" sx={{ color: '#87fcd9', fontWeight: 700 }}>REQUISITOS</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {currentOption.items.map((item, i) => (
                    <Chip key={i} icon={<CheckCircleOutlineIcon sx={{ fontSize: '16px !important', color: '#87fcd9 !important' }} />} label={item} variant="outlined" sx={{ color: 'rgba(255,255,255,0.9)' }} />
                  ))}
                </Box>
              </Paper>
            )}
          </Box>
        </Grid>

        {/* RIGHT: evidencias / área de carga. Si estamos en RECALCULO o CATEGORIAS ocultamos esta área */}
        {!isRecalculoPanel && !isCategoryPanel ? (
          <Grid item xs={12} lg={8}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
              <Typography variant="h6" sx={{ color: 'white' }}>Evidencias ({slots.length})</Typography>
            </Box>

            <Grid container spacing={3}>
              <AnimatePresence>
                {slots.map((slot) => (
                  <Grid item xs={12} md={6} lg={4} key={slot.id} component={motion.div} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                    <ImageSlot slot={slot} onChange={handleSlotChange} onDelete={handleSlotDelete} />
                  </Grid>
                ))}
              </AnimatePresence>
            </Grid>
            <div ref={slotsEndRef} />

            {totalToProcess > 0 && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={progressValue} />
                <Typography variant="caption" sx={{ color: 'white', mt: 1 }}>{processedCount} / {totalToProcess} procesadas</Typography>
              </Box>
            )}
          </Grid>
        ) : (
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.92)', mb: 1 }}>
                Esta pestaña es de consulta y cálculo solamente. No puedes añadir evidencias ni generar reportes desde aquí.
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Usa las pestañas de Conductor/Usuario para crear incidencias y generar reportes con evidencias.
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Bottom action bar (Añadir extra / Descargar reporte) - oculto en RECALCULO y CATEGORIAS */}
      {!isRecalculoPanel && !isCategoryPanel && (
        <Paper
          elevation={24}
          sx={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            p: 1,
            borderRadius: '50px',
            display: 'flex',
            gap: 2,
            bgcolor: 'rgba(26, 26, 46, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #87fcd9',
            boxShadow: '0 0 20px rgba(135, 252, 217, 0.2)'
          }}
        >
          <Button variant="text" startIcon={<AddIcon />} onClick={handleAddSlot} sx={{ color: '#87fcd9', px: 3, borderRadius: '30px', fontWeight: 'bold' }}>
            Añadir Extra
          </Button>
          <Button variant="contained" startIcon={<DescriptionIcon />} onClick={handleGenerateWord} disabled={loading} sx={{ bgcolor: '#87fcd9', color: '#1a1a2e', fontWeight: '900', px: 4, borderRadius: '30px' }}>
            {loading ? 'Procesando...' : 'Descargar Reporte'}
          </Button>
        </Paper>
      )}
    </Container>
  );
}
