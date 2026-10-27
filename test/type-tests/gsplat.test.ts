import { GSPLAT_RENDERER_STEADY } from '../../build/playcanvas.js';
import type { Application } from '../../build/playcanvas.js';

declare const app: Application;

app.scene.gsplat.renderer = GSPLAT_RENDERER_STEADY;
app.scene.gsplat.steadyHistoryWeight = 0.7;
app.scene.gsplat.steadyConvergence = true;
app.scene.gsplat.steadyConvergenceFrames = 16;
const resetResult: void = app.scene.gsplat.resetHistory();
const renderer: number = app.scene.gsplat.currentRenderer;

// @ts-expect-error History retention is numeric.
app.scene.gsplat.steadyHistoryWeight = 'high';

// @ts-expect-error Stationary convergence is a boolean.
app.scene.gsplat.steadyConvergence = 1;

// @ts-expect-error The refinement limit is numeric.
app.scene.gsplat.steadyConvergenceFrames = 'sixteen';

// @ts-expect-error Reset applies to all camera/layer histories without accepting a camera argument.
app.scene.gsplat.resetHistory({});
