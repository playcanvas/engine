/**
 * EngineExtras is a collection of supplementary APIs designed to extend the capabilities of the
 * PlayCanvas Engine. They cover features such as gizmos, file export, runtime performance
 * profiling and advanced post-processing effects.
 *
 * @module EngineExtras
 */

export { MiniStats } from './mini-stats/mini-stats.js';

// exporters
export { UsdzExporter } from './exporters/usdz-exporter.js';
export { GltfExporter } from './exporters/gltf-exporter.js';

// splat
export { registerPlyParser, getDefaultPlyElements } from './splat/ply-parser.js';
export { Splat } from './splat/splat.js';
export { SplatData } from './splat/splat-data.js';
export { SplatInstance } from './splat/splat-instance.js';

// render passes
export { RenderPassCameraFrame } from './render-passes/render-pass-camera-frame.js';
export { RenderPassCompose } from './render-passes/render-pass-compose.js';
export { RenderPassDownsample } from './render-passes/render-pass-downsample.js';
export { RenderPassUpsample } from './render-passes/render-pass-upsample.js';
export { RenderPassBloom } from './render-passes/render-pass-bloom.js';
export { RenderPassTAA } from './render-passes/render-pass-taa.js';

// gizmo
export { Gizmo } from "./gizmo/gizmo.js";
export { TransformGizmo } from "./gizmo/transform-gizmo.js";
export { TranslateGizmo } from "./gizmo/translate-gizmo.js";
export { RotateGizmo } from "./gizmo/rotate-gizmo.js";
export { ScaleGizmo } from "./gizmo/scale-gizmo.js";
