// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { Drawer, List, ListItemButton, ListItemText, Box, Typography } from '@mui/material';
import { CMC_STRUCTURE } from '../data/cmcData';
import { motion } from 'framer-motion';
import CircleIcon from '@mui/icons-material/Circle';

const drawerWidth = 280;

export default function Sidebar({ onSelectOption }) {
  // Estado para solucionar el bug de selección doble (usamos Categoría y Opción)
  const [activeSelection, setActiveSelection] = useState({
    category: "CONDUCTOR",
    option: "CAMBIO DE MONTO CASH (CMC)"
  });

  const handleListItemClick = (optionName, category) => {
    setActiveSelection({ category, option: optionName });
    onSelectOption(optionName, category);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { 
            width: drawerWidth, 
            boxSizing: 'border-box',
            border: 'none',
            background: 'transparent'
        },
      }}
    >
      <Box sx={{ 
          m: 2, 
          height: '95vh', 
          borderRadius: '24px',
          background: 'rgba(53, 54, 186, 0.85)', 
          backdropFilter: 'blur(20px)', 
          border: '1px solid rgba(135, 252, 217, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          overflowY: 'auto',
          '::-webkit-scrollbar': { display: 'none' } 
      }}>
        
        {/* LOGO AREA */}
        <Box sx={{ p: 4, pb: 2, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '1px', color: 'white', fontStyle: 'italic' }}>
                RIDERY
            </Typography>
            <Typography variant="caption" sx={{ color: '#87fcd9', letterSpacing: '2px', fontWeight: 'bold' }}>
                VENEZUELA
            </Typography>
        </Box>

        {/* LISTA DE NAVEGACIÓN */}
        <Box sx={{ py: 2 }}>
            {Object.entries(CMC_STRUCTURE).map(([category, data]) => (
            <Box key={category} sx={{ mb: 3 }}>
                
                {/* TÍTULO DE CATEGORÍA */}
                <Box sx={{ px: 3, mb: 1, display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                        width: '4px', height: '15px', 
                        bgcolor: category === 'CONDUCTOR' ? '#fff' : '#87fcd9',
                        mr: 1, borderRadius: '2px'
                    }} />
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            color: 'white', 
                            fontWeight: 800, 
                            letterSpacing: '1px',
                            opacity: 0.9
                        }}
                    >
                        {category}
                    </Typography>
                </Box>
                
                <List sx={{ px: 1 }}>
                {Object.entries(data.options).map(([optionName]) => {
                    // COMPARACIÓN COMPUESTA
                    const isSelected = activeSelection.option === optionName && activeSelection.category === category;
                    
                    return (
                    <ListItemButton 
                        key={optionName} 
                        selected={isSelected}
                        onClick={() => handleListItemClick(optionName, category)}
                        component={motion.div} 
                        whileHover={{ x: 5 }}
                        whileTap={{ scale: 0.98 }}
                        sx={{ 
                            mx: 1, mb: 0.5, borderRadius: '12px',
                            transition: 'all 0.2s ease',
                            background: isSelected ? 'rgba(135, 252, 217, 0.2)' : 'transparent',
                            border: isSelected ? '1px solid #87fcd9' : '1px solid transparent',
                            '&:hover': { background: 'rgba(255,255,255,0.1)' }
                        }}
                    >
                        <CircleIcon 
                            sx={{ 
                                fontSize: 8, 
                                mr: 2, 
                                color: isSelected ? '#87fcd9' : 'rgba(255,255,255,0.3)',
                                filter: isSelected ? 'drop-shadow(0 0 5px #87fcd9)' : 'none'
                            }} 
                        />
                        
                        <ListItemText 
                            primary={optionName} 
                            primaryTypographyProps={{ 
                                fontSize: '0.8rem', 
                                fontWeight: isSelected ? 700 : 400, 
                                color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                letterSpacing: '0.5px'
                            }} 
                        />
                    </ListItemButton>
                    );
                })}
                </List>
            </Box>
            ))}
        </Box>
      </Box>
    </Drawer>
  );
}