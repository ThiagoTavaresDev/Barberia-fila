import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme, DEFAULT_THEME_ID } from './utils/themes';

// Tema padrão já na primeira pintura; o ThemeProvider troca pelo da barbearia quando carregar
applyTheme(DEFAULT_THEME_ID);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);