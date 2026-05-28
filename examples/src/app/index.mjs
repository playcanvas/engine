import { createRoot } from 'react-dom/client';

import { MainLayout } from './components/MainLayout.mjs';
import { jsx } from './jsx.mjs';
import { blockZoom } from '../../iframe/zoom.mjs';


import '@playcanvas/pcui/styles';

if (process.env.NODE_ENV === 'development' && import.meta.hot) {
    import('./dev-server.mjs');
}

function main() {
    blockZoom();

    // render out the app
    const container = document.getElementById('app');
    if (!container) {
        return;
    }
    const root = createRoot(container);
    root.render(jsx(MainLayout, null));
}

main();
