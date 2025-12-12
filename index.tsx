import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Suppress deprecated GLTF extension warning
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('KHR_materials_pbrSpecularGlossiness')) return;
  originalWarn(...args);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);