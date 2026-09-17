// @config
// @flag WEBGL_DISABLED
//
// Compares depth-based fog computed from a resolved depth value (left) against fog evaluated
// per-sample from a multisampled depth buffer (right). No single resolved depth - whichever
// resolve mode is used - can produce fog matching the antialiased color at geometry silhouettes,
// while the per-sample fog on the right does. The render targets are rendered at a reduced
// resolution (Pixel Scale) to make the per-pixel differences visible.

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    DEPTHRESOLVE_MIN,
    Entity,
    FILLMODE_FILL_WINDOW,
    Layer,
    PIXELFORMAT_DEPTH,
    PIXELFORMAT_R32F,
    PIXELFORMAT_RGBA16F,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    SEMANTIC_POSITION,
    ShaderMaterial,
    StandardMaterial,
    Texture,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

//
//  Why MSAA and depth-based effects conflict
//  -----------------------------------------
//  MSAA antialiases geometry edges by storing multiple samples per pixel and averaging them. At a
//  silhouette, a pixel's samples straddle two surfaces - some hold the near object, others the far
//  background - and the resolved color is a blend of both. A depth-based effect such as fog,
//  however, is usually computed *after* the resolve, from a single depth value per pixel. Because
//  fog is a non-linear function of depth, no single value can represent a pixel that covers two
//  depths: fog(resolve(depth samples)) is not the same as resolve(fog applied per sample). The
//  result is a fog boundary that does not match the antialiased color - a one-pixel halo that
//  crawls along silhouettes as the camera moves.
//
//  Which single depth value is used only changes how it fails. This example resolves the
//  multisampled depth into a single-sampled texture using the render target's depthResolveBuffer,
//  with the resolve operation selectable via RenderTarget#depthResolveMode (WebGPU has no hardware
//  depth resolve, so this is a shader-based resolve provided by the engine):
//  - DEPTHRESOLVE_MIN: the nearest surface wins - background samples at an edge get the
//    foreground's fog, bleeding fog outward from silhouettes.
//  - DEPTHRESOLVE_MAX: the farthest surface wins - foreground edges lose their fog, appearing to
//    cut sharp holes into the fog.
//  - DEPTHRESOLVE_SAMPLE0: an arbitrary sample wins - edge pixels pick near or far essentially at
//    random, sparkling in motion.
//
//  The correct result requires access to the individual samples. The scene is rendered into a
//  render target whose colorBuffer and depthBuffer are both multisampled textures (created with
//  samples: 4), which keeps their samples available to shaders. A fullscreen compose pass then
//  binds them as texture_multisampled_2d / texture_depth_multisampled_2d and, on the right side of
//  the split, evaluates the fog independently for every sample - fogging each color sample at its
//  own depth before averaging - which makes the fog boundary match the antialiased color exactly.
//  The left side applies a single fog value, computed from the resolved depth, to the averaged
//  color, demonstrating the artifact with whichever resolve mode is selected.
//
//  The render target is rendered at a reduced resolution (the Pixel Scale control) and upscaled
//  without filtering, so each rendered pixel covers a block of screen pixels and the per-pixel
//  difference between the two techniques is visible even on high-density displays.
//

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
createOptions.resourceHandlers = [];

const app = new AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

data.set('data', {
    split: 0.5,
    pixelScale: 5,
    density: 0.1,
    mode: DEPTHRESOLVE_MIN,
    animate: true
});

// ---- scene: rows of thin emissive pillars receding into the distance - high contrast depth
// discontinuities at their silhouettes, the worst case for fog computed from resolved depth
const pillarColors = [new Color(1, 0.5, 0.2), new Color(0.3, 0.7, 1), new Color(0.9, 0.9, 0.6), new Color(0.5, 1, 0.6)];
for (let i = 0; i < 60; i++) {
    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.emissive = pillarColors[i % pillarColors.length];
    material.emissiveIntensity = 2.5;
    material.update();

    const pillar = new Entity(`pillar${i}`);
    pillar.addComponent('render', { type: 'box', material });
    pillar.setLocalScale(0.12, 4, 0.12);
    const z = -3 - (i % 15) * 1.8;
    const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 8 - 4;
    pillar.setPosition(x, 0, z);
    app.root.addChild(pillar);
}

const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = Color.BLACK;
groundMaterial.emissive = new Color(0.04, 0.04, 0.05);
groundMaterial.update();
const ground = new Entity('ground');
ground.addComponent('render', { type: 'plane', material: groundMaterial });
ground.setLocalScale(60, 1, 60);
ground.setPosition(0, -2, -15);
app.root.addChild(ground);

// ---- render target: multisampled color and depth textures, with the depth also resolved into a
// single-sampled R32F texture at the end of the render pass, using the selected depthResolveMode
const createTargets = (width, height) => {
    const msColor = new Texture(device, { name: 'msColor', width, height, format: PIXELFORMAT_RGBA16F, samples: 4 });
    const msDepth = new Texture(device, { name: 'msDepth', width, height, format: PIXELFORMAT_DEPTH, samples: 4 });
    const resolvedDepth = new Texture(device, {
        name: 'resolvedDepth',
        width,
        height,
        format: PIXELFORMAT_R32F,
        mipmaps: false
    });
    const sceneRt = new RenderTarget({
        name: 'sceneRt',
        colorBuffer: msColor,
        depthBuffer: msDepth,
        depthResolveBuffer: resolvedDepth
    });
    return { msColor, msDepth, resolvedDepth, sceneRt };
};

let currentPixelScale = 0;
const targetSize = () => {
    const scale = data.get('data.pixelScale') ?? 5;
    // the canvas resolution is applied on the first frame, so the device size can still be 0 here
    return [Math.max(1, Math.floor(device.width / scale)), Math.max(1, Math.floor(device.height / scale)), scale];
};

const [initialWidth, initialHeight, initialScale] = targetSize();
currentPixelScale = initialScale;
const targets = createTargets(initialWidth, initialHeight);

const resizeTargets = () => {
    const [width, height, scale] = targetSize();
    currentPixelScale = scale;
    targets.sceneRt.resize(width, height);
};

// ---- scene camera rendering into the multisampled target
const NEAR = 0.5,
    FAR = 60;
const camScene = new Entity('camScene');
camScene.addComponent('camera', {
    clearColor: new Color(0, 0, 0),
    nearClip: NEAR,
    farClip: FAR,
    priority: 0,
    renderTarget: targets.sceneRt
});
camScene.setPosition(0, 0.5, 3);
app.root.addChild(camScene);

// ---- compose pass: fullscreen shader combining the two fog techniques side by side
const composeMaterial = new ShaderMaterial({
    uniqueName: 'MsaaDepthFog',
    vertexWGSL: /* wgsl */ `
        attribute aPosition: vec4f;
        uniform matrix_model: mat4x4f;
        uniform matrix_viewProjection: mat4x4f;
        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.position = uniform.matrix_viewProjection * uniform.matrix_model * aPosition;
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */ `
        #include "gammaPS"

        var msColor: texture_multisampled_2d<f32>;
        var msDepth: texture_depth_multisampled_2d;
        var resolvedDepth: texture_2d<f32>;
        uniform uSplit: f32;
        uniform uPixelScale: f32;
        uniform uDensity: f32;
        uniform uNearFar: vec2f;

        fn linearizeDepth(d: f32) -> f32 {
            let near = uniform.uNearFar.x;
            let far = uniform.uNearFar.y;
            return near * far / (far - d * (far - near));
        }

        fn fogFactor(linearDepth: f32) -> f32 {
            return 1.0 - exp(-uniform.uDensity * linearDepth);
        }

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;

            let fogColor = vec3f(0.48, 0.52, 0.6);
            let dims = vec2i(textureDimensions(resolvedDepth));
            let coord = min(vec2i(pcPosition.xy / uniform.uPixelScale), dims - vec2i(1));
            let splitX = uniform.uSplit * f32(dims.x) * uniform.uPixelScale;
            let count = i32(textureNumSamples(msColor));

            var color: vec3f;
            if (pcPosition.x < splitX) {
                // fog from the resolved depth - one fog value for the whole pixel, applied to the
                // averaged color. Whichever resolve mode produced the depth, the fog boundary
                // cannot match the antialiased color at silhouettes.
                var avg = vec3f(0.0);
                for (var s = 0; s < count; s++) {
                    avg += textureLoad(msColor, coord, s).rgb;
                }
                avg /= f32(count);
                let lin = linearizeDepth(textureLoad(resolvedDepth, coord, 0).r);
                color = mix(avg, fogColor, fogFactor(lin));
            } else {
                // per-sample fog - each sample is fogged at its own depth, then averaged, so the
                // fog boundary matches the antialiased color exactly
                var sum = vec3f(0.0);
                for (var s = 0; s < count; s++) {
                    let c = textureLoad(msColor, coord, s).rgb;
                    let lin = linearizeDepth(textureLoad(msDepth, coord, s));
                    sum += mix(c, fogColor, fogFactor(lin));
                }
                color = sum / f32(count);
            }

            // split line
            if (abs(pcPosition.x - splitX) < 1.5) {
                color = vec3f(1.0);
            }

            output.color = vec4f(gammaCorrectOutput(color), 1.0);
            return output;
        }
    `,
    attributes: { aPosition: SEMANTIC_POSITION }
});
composeMaterial.setParameter('msColor', targets.msColor);
composeMaterial.setParameter('msDepth', targets.msDepth);
composeMaterial.setParameter('resolvedDepth', targets.resolvedDepth);
composeMaterial.setParameter('uNearFar', [NEAR, FAR]);

const composeLayer = new Layer({ name: 'Compose' });
app.scene.layers.push(composeLayer);

const composeQuad = new Entity('composeQuad');
composeQuad.addComponent('render', { type: 'box', material: composeMaterial, layers: [composeLayer.id] });
composeQuad.setLocalScale(10, 10, 1);
app.root.addChild(composeQuad);

const camCompose = new Entity('camCompose');
camCompose.addComponent('camera', { clearColor: new Color(0, 0, 0), priority: 1, layers: [composeLayer.id] });
camCompose.setPosition(0, 0, 3);
app.root.addChild(camCompose);

// keep the render target in sync with the canvas size and the pixel scale - RenderTarget#resize
// also resizes the multisampled color and depth buffers and the depth resolve buffer
device.on('resizecanvas', resizeTargets);

// sway the camera and update the uniforms
let time = 0;
app.on('update', (dt) => {
    if (data.get('data.animate') ?? true) {
        time += dt;
        camScene.setPosition(Math.sin(time * 0.3) * 0.8, 0.5 + Math.sin(time * 0.13) * 0.3, 3);
    }

    if ((data.get('data.pixelScale') ?? 5) !== currentPixelScale) {
        resizeTargets();
    }

    // the depth resolve mode of the render target can be changed at any time
    targets.sceneRt.depthResolveMode = data.get('data.mode') ?? DEPTHRESOLVE_MIN;

    composeMaterial.setParameter('uSplit', data.get('data.split') ?? 0.5);
    composeMaterial.setParameter('uPixelScale', currentPixelScale);
    composeMaterial.setParameter('uDensity', data.get('data.density') ?? 0.1);
});

export { app };
