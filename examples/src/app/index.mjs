import { createRoot } from 'react-dom/client';
import { jsx } from './jsx.mjs';
import { MainLayout } from './MainLayout.mjs';
import '@playcanvas/pcui/styles';

function main() {
    // render out the app
    const container = document.getElementById('app');
    if (!container) {
        return;
    }
    const root = createRoot(container);
    root.render(jsx(MainLayout, null));
}

window.onload = () => {
    // Just a little timeout to give browser some time to "breathe"
    setTimeout(main, 50);
};
