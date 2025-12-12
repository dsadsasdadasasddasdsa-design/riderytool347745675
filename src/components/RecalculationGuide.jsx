import React, { useState } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Typography, Box, Button, TextField } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/**
 * RecalculationGuide (editable, compacto)
 * - Ahora solo muestra el botón "Editar" si isAdmin === true
 *
 * Props:
 *  - guideHtml: string HTML content
 *  - onSave(optionKey, newHtml): callback opcional
 *  - optionKey: identifier for this guide (defaults to 'RECÁLCULO')
 *  - isAdmin: boolean - whether the current user is admin (controls visibility of Edit)
 */
export default function RecalculationGuide({ guideHtml = '', onSave = null, optionKey = 'RECÁLCULO', isAdmin = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(guideHtml || '');

  const handleStartEdit = () => {
    setDraft(guideHtml || '');
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft(guideHtml || '');
  };

  const handleSave = () => {
    if (!isAdmin) {
      alert('Acción restringida: solo administradores pueden editar las guías.');
      setEditing(false);
      return;
    }

    if (typeof onSave === 'function') {
      onSave(optionKey, draft || '');
    } else {
      try {
        const all = JSON.parse(localStorage.getItem('cmc_guides') || '{}');
        all[optionKey] = draft || '';
        localStorage.setItem('cmc_guides', JSON.stringify(all));
      } catch (e) {
        console.warn('No se pudo guardar la guía en localStorage', e);
      }
    }
    setEditing(false);
  };

  return (
    <Accordion defaultExpanded={false} sx={{
      bgcolor: 'rgba(20,20,40,0.72)',
      color: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(135,252,217,0.06)',
      borderRadius: 2,
      mb: 1
    }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#87fcd9' }} />} aria-controls="rec-guide-content" id="rec-guide-header" sx={{ px: 1, py: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ color: '#87fcd9', fontWeight: 800, letterSpacing: 0.2 }}>Guía: {optionKey}</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Consulta paso a paso</Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 1, pb: 1, pt: 0 }}>
        {!editing ? (
          <Box sx={{
            '& h2': { color: '#eaf6ff', fontWeight: 800, mb: 0.4 },
            '& h3': { color: '#eaf6ff', fontWeight: 700, mb: 0.3 },
            '& p': { color: 'rgba(255,255,255,0.92)', lineHeight: 1.32, mb: 0.5 },
            '& ul': { color: 'rgba(255,255,255,0.92)', paddingLeft: 16, mb: 0.5 },
            '& li': { marginBottom: 6 }
          }}>
            <Box dangerouslySetInnerHTML={{ __html: guideHtml || '<p>No hay guía disponible. Solo administradores pueden agregarla.</p>' }} />
            <Box sx={{ mt: 0.75 }}>
              {isAdmin ? (
                <Button size="small" onClick={handleStartEdit} variant="outlined" sx={{ color: '#87fcd9', borderColor: '#87fcd9' }}>Editar</Button>
              ) : null}
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1, display: 'block' }}>Edita el HTML de la guía. Guarda para que se aplique y se conserve en localStorage.</Typography>
            <TextField
              multiline
              minRows={8}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              fullWidth
              sx={{ bgcolor: 'rgba(255,255,255,0.02)', '& .MuiInputBase-input': { color: '#fff' } }}
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button size="small" variant="contained" onClick={handleSave} sx={{ bgcolor: '#87fcd9', color: '#1a1a2e' }}>Guardar</Button>
              <Button size="small" variant="outlined" onClick={handleCancel} sx={{ color: '#87fcd9', borderColor: '#87fcd9' }}>Cancelar</Button>
            </Box>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}