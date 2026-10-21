import { GSPLAT_RENDERER_STEADY } from '../../build/playcanvas.js';
import type { Application } from '../../build/playcanvas.js';

declare const app: Application;

app.scene.gsplat.renderer = GSPLAT_RENDERER_STEADY;
app.scene.gsplat.steadyHistoryWeight = 0.7;
const resetResult: void = app.scene.gsplat.resetHistory();
const renderer: number = app.scene.gsplat.currentRenderer;

// @ts-expect-error History retention is numeric.
app.scene.gsplat.steadyHistoryWeight = 'high';

// @ts-expect-error Reset applies to all camera/layer histories without accepting a camera argument.
app.scene.gsplat.resetHistory({});
