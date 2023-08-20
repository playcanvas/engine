import React from 'react';
import * as pcui from '@playcanvas/pcui/react';
import { createRoot } from 'react-dom/client';
import '@playcanvas/pcui/styles';
import { jsx          } from './jsx.mjs';
import { MainLayout } from './MainLayout.mjs';
import '@playcanvas/pcui/styles';

Object.assign(window, {
    pcui,
    React,
});

function main() {
    // render out the app
    const container = document.getElementById('app');
    const root = createRoot(container);
    root.render(jsx(MainLayout, null));
}

window.onload = () => {
    // Just a little timeout to give browser some time to "breathe"
    setTimeout(main, 50);
};
