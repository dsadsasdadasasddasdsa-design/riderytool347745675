import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Packer, Paragraph, ImageRun, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { Container, Button, Grid, Typography, Box, Paper, Chip, List, ListItem, LinearProgress } from '@mui/material';
import ImageSlot from './ImageSlot';
import { processImageForReport } from '../utils/cmcImageProcessor';
import { nanoid } from 'nanoid';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { motion, AnimatePresence } from 'framer-motion';
import pLimit from 'p-limit';

const createNewSlot = (title = 'Evidencia Adicional') => ({
  id: nanoid(), file: null, title: title, rotation: 0, orientation: 'horizontal'
});

const FONT_SIZE = 18;
const BORDER_COLOR = 'E0E0E0';

const CONCURRENCY_LIMIT = 3;

const generateImageTable = async (slots, cols, docChildren, onProgress) => {
  if (!slots || slots.length === 0) return;

  const limit = pLimit(CONCURRENCY_LIMIT);

  const processed = await Promise.all(slots.map(s => limit(() => processImageForReport(s.file, s.rotation, s.orientation).then(r => {
    if (onProgress) onProgress();
    return { slot: s, result: r };
  }))));

  const rows = [];
  let currentCells = [];
  const cellWidthPercent = 100 / cols;

  for (let i = 0; i < processed.length; i++) {
    const { slot, result } = processed[i];

    const cellContent = [
      new Paragraph({
        children: [new TextRun({ text: slot.title || 'Evidencia', bold: true, size: FONT_SIZE, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 }
      }),
      new Paragraph({
        children: [new ImageRun({ data: result.buffer, transformation: { width: result.width, height: result.height }, type: 'jpg' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 }
      })
    ];

    const cell = new TableCell({
      children: cellContent,
      width: { size: cellWidthPercent, type: WidthType.PERCENTAGE },
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
        width: { size: cellWidthPercent, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL } }
      }));
    }
    rows.push(new TableRow({ children: currentCells }));
  }

  const imageTable = new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
  docChildren.push(imageTable);
  docChildren.push(new Paragraph({ text: '', spacing: { after: 200 } }));
};

export default function ReportGenerator({ currentOption }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const slotsEndRef = useRef(null);
  const [showPDFGuide, setShowPDFGuide] = useState(false);

  useEffect(() => {
    const requiredItems = currentOption?.items || [];
    let initialSlots = requiredItems.map(itemTitle => createNewSlot(itemTitle));
    if (initialSlots.length === 0) initialSlots.push(createNewSlot('Evidencia Principal'));
    setSlots(initialSlots);
    setShowPDFGuide(false);
  }, [currentOption]);

  const handleAddSlot = useCallback(() => setSlots(prev => [...prev, createNewSlot('Nueva Evidencia')]), []);
  const handleSlotChange = useCallback((u) => setSlots(p => p.map(s => s.id === u.id ? { ...u } : s)), []);
  const handleSlotDelete = useCallback((id) => {
    setSlots(prev => {
      if (prev.length === 1) return [createNewSlot('Evidencia Principal')];
      return prev.filter(s => s.id !== id);
    });
  }, []);

  const handleGenerateWord = async () => {
    const validSlots = slots.filter(s => s.file);
    if (validSlots.length === 0) { alert('Sube al menos una imagen.'); return; }

    setLoading(true);
    setProcessedCount(0);
    setTotalToProcess(validSlots.length);

    try {
      const docChildren = [];

      docChildren.push(new Paragraph({ children: [new TextRun({ text: 'REPORTE CMC', bold: true, size: 28, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }));

      if (currentOption) {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: `CASO: ${currentOption.name}`, bold: true, size: 24, font: 'Calibri' })], spacing: { after: 200 } }));
      }

      const horizontalSlots = validSlots.filter(s => s.orientation === 'horizontal');
      const verticalSlots = validSlots.filter(s => s.orientation === 'vertical');

      const onProgress = () => setProcessedCount(p => p + 1);

      if (horizontalSlots.length > 0) {
        await generateImageTable(horizontalSlots, 3, docChildren, onProgress);
      }

      if (verticalSlots.length > 0) {
        await generateImageTable(verticalSlots, 4, docChildren, onProgress);
      }

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

      setShowPDFGuide(true);
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

  return (
    <Container maxWidth="xl" sx={{ pb: 15 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 800 }}>{currentOption?.name}</Typography>
          <Chip label={currentOption?.category} sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#87fcd9', fontWeight: 'bold' }} />
        </Box>
      </motion.div>

      {showPDFGuide && (
        <Paper elevation={3} sx={{ p: 3, mb: 4, bgcolor: '#3536ba', border: '2px solid #87fcd9', borderRadius: '16px' }}>
          <Typography variant="h6" sx={{ color: '#87fcd9', mb: 1 }}>✅ ¡Reporte Descargado! Pasos para PDF de Alta Calidad</Typography>
          <Typography variant="body1" sx={{ color: 'white' }}>Para obtener el PDF con la mejor calidad y formato (como en Word), por favor:</Typography>
          <List dense>
            <ListItem sx={{ color: 'white', py: 0 }}>1. Abra el archivo .docx recién descargado en Word.</ListItem>
            <ListItem sx={{ color: 'white', py: 0 }}>2. Vaya a Archivo &amp;gt; Exportar.</ListItem>
            <ListItem sx={{ color: 'white', py: 0 }}>3. Seleccione la ubicacion del archivo y guarde.</ListItem>
          </List>
        </Paper>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {currentOption?.warning && (
              <Paper sx={{ bgcolor: 'rgba(255, 55, 117, 0.15)', border: '1px solid #ff3775', p: 2, borderRadius: '16px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#ff3775', mb: 1 }}>
                  <WarningAmberIcon /><Typography variant="h6">Atención</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#ffc1e3' }}>{currentOption.warning}</Typography>
              </Paper>
            )}

            {currentOption?.items && (
              <Paper sx={{ p: 2, bgcolor: 'rgba(20, 20, 40, 0.6)', border: '1px solid rgba(135, 252, 217, 0.2)', borderRadius: '16px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                  <AssignmentIcon sx={{ color: '#87fcd9' }} />
                  <Typography variant="subtitle1" sx={{ color: '#87fcd9', fontWeight: 700 }}>REQUISITOS</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {currentOption.items.map((item, i) => (
                    <Chip key={i} icon={<CheckCircleOutlineIcon sx={{ fontSize: '16px !important', color: '#87fcd9 !important' }} />} label={item} variant="outlined" sx={{ color: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.02)', height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal', fontSize: '0.8rem' } }} />
                  ))}
                </Box>
              </Paper>
            )}
          </Box>
        </Grid>

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
      </Grid>

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
        <Button variant="contained" startIcon={<DescriptionIcon />} onClick={handleGenerateWord} disabled={loading} sx={{ bgcolor: '#87fcd9', color: '#1a1a2e', fontWeight: '900', px: 4, borderRadius: '30px', '&:hover': { bgcolor: '#fff', transform: 'scale(1.05)' } }}>
          {loading ? 'Procesando...' : 'Descargar Reporte'}
        </Button>
      </Paper>
    </Container>
  );
}
