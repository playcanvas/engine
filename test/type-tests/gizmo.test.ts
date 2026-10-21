import type { BoundingBoxGizmo, Color, RotateGizmo, ScaleGizmo, TranslateGizmo } from '../../build/playcanvas.js';

declare const bounds: BoundingBoxGizmo;
declare const rotate: RotateGizmo;
declare const translate: TranslateGizmo;
declare const scale: ScaleGizmo;
declare const color: Color;

// the bounding box theme keeps its base and occluded colors
const base: Color = bounds.theme.base;
const occluded: Color = bounds.theme.occluded;
bounds.setTheme({ base: color, occluded: color });
bounds.armLength = 0.5;
bounds.padding = 0.02;
bounds.armThickness = 3;

// snapping keeps its settings on the transform gizmos, the rotate gizmo's increment deprecated
translate.snap = true;
translate.snapIncrement = 0.5;
scale.snapIncrement = 0.25;
rotate.snapIncrement = 15;
rotate.snapAngleIncrement = 15;
