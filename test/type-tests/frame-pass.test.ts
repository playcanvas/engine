import type { CameraComponent, ComputePass, FramePass, RenderPass, RenderPassForward, RenderPassShaderQuad } from '../../build/playcanvas.js';

declare const camera: CameraComponent;
declare const framePass: FramePass;
declare const renderPass: RenderPass;
declare const forwardPass: RenderPassForward;
declare const quadPass: RenderPassShaderQuad;
declare const computePass: ComputePass;

// the camera renders with passes of any kind, and returns to its default rendering with null
camera.framePasses = [forwardPass, quadPass];
camera.framePasses = null;
const passes: FramePass[] = camera.framePasses;

// passes of any kind render before and after the camera, and before and after other passes
camera.beforePasses.push(computePass);
camera.afterPasses.push(quadPass);
framePass.beforePasses.push(renderPass);
framePass.afterPasses.push(forwardPass);

// the callbacks receive the pass
quadPass.onBefore = (pass) => {
    const enabled: boolean = pass.enabled;
};
quadPass.onAfter = null;

// @ts-expect-error The frame passes must be frame passes.
camera.framePasses = [camera];
