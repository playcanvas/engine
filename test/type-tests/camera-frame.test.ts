import type { CameraFrame } from '../../build/playcanvas.js';

declare const cameraFrame: CameraFrame;

// the built-in debug modes
cameraFrame.debug = 'depth';
cameraFrame.debug = 'vignette';
cameraFrame.debug = null;

// the debug view of a registered custom effect
cameraFrame.debug = 'grain';

// reading the mode back gives a string or null
const mode: string | null = cameraFrame.debug;

// @ts-expect-error The mode is a name, not a number.
cameraFrame.debug = 1;
