import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App';

try {
  const html = renderToString(React.createElement(App));
  console.log('App SSR Render successful! Length:', html.length);
} catch(err) {
  console.error('App SSR Render FAILED with error:', err);
}
