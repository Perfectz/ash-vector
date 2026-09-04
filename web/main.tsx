import React from 'react';
import { createRoot } from 'react-dom/client';
import Game from '../app/game/Game';
import '../app/globals.css';
import './standalone.css';

createRoot(document.getElementById('root')!).render(<Game />);
