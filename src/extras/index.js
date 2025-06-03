/**
 * Extras is a collection of supplementary APIs designed to extend the capabilities of the
 * PlayCanvas Engine. They cover features such as gizmos, file export, runtime performance
 * profiling and advanced post-processing effects.
 */

export { MiniStats } from './mini-stats/mini-stats.js';

// RENDERERS
export { OutlineRenderer } from './renderers/outline-renderer.js';

// EXPORTERS
export { UsdzExporter } from './exporters/usdz-exporter.js';
export { GltfExporter } from './exporters/gltf-exporter.js';

// RENDER PASSES
export { SSAOTYPE_NONE, SSAOTYPE_LIGHTING, SSAOTYPE_COMBINE } from './render-passes/constants.js';
export { RenderPassCameraFrame, CameraFrameOptions } from './render-passes/render-pass-camera-frame.js';
export { RenderPassCompose } from './render-passes/render-pass-compose.js';
export { RenderPassDepthAwareBlur } from './render-passes/render-pass-depth-aware-blur.js';
export { RenderPassDof } from './render-passes/render-pass-dof.js';
export { RenderPassDownsample } from './render-passes/render-pass-downsample.js';
export { RenderPassUpsample } from './render-passes/render-pass-upsample.js';
export { RenderPassBloom } from './render-passes/render-pass-bloom.js';
export { RenderPassPrepass } from './render-passes/render-pass-prepass.js';
export { RenderPassSsao } from './render-passes/render-pass-ssao.js';
export { RenderPassTAA } from './render-passes/render-pass-taa.js';
export { CameraFrame } from './render-passes/camera-frame.js';

// INPUT
export { InputDelta, InputSource, InputController } from './input/input.js';
export { Pose } from './input/pose.js';

// INPUT SOURCES
export { SingleGestureSource } from './input/sources/single-gesture-source.js';
export { DualGestureSource } from './input/sources/dual-gesture-source.js';
export { MultiTouchSource } from './input/sources/multi-touch-source.js';
export { KeyboardMouseSource } from './input/sources/keyboard-mouse-source.js';
export { GamepadSource } from './input/sources/gamepad-source.js';

// INPUT CONTROLLERS
export { FlyController } from './input/controllers/fly-controller.js';
export { OrbitController } from './input/controllers/orbit-controller.js';

// GIZMOS
export {
    GIZMOSPACE_LOCAL,
    GIZMOSPACE_WORLD,
    GIZMOAXIS_X,
    GIZMOAXIS_Y,
    GIZMOAXIS_Z,
    GIZMOAXIS_XY,
    GIZMOAXIS_XZ,
    GIZMOAXIS_YZ,
    GIZMOAXIS_XYZ,
    GIZMOAXIS_FACE
} from './gizmo/constants.js';
export { Gizmo } from './gizmo/gizmo.js';
export { TransformGizmo } from './gizmo/transform-gizmo.js';
export { TranslateGizmo } from './gizmo/translate-gizmo.js';
export { RotateGizmo } from './gizmo/rotate-gizmo.js';
export { ScaleGizmo } from './gizmo/scale-gizmo.js';
export { ViewCube } from './gizmo/view-cube.js';
