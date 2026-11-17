import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { installPointerTracking } from './mobile.js';
import { DialogProvider } from './components/Dialog.jsx';

installPointerTracking();

createRoot(document.getElementById('root')).render(
  <DialogProvider>
    <App />
  </DialogProvider>,
);
