// @config
// @flag WEBGL_DISABLED
//
// Compares the hardware MSAA box resolve (left) with a custom resolve (right), which reads the
// individual samples of a multisampled texture using textureLoad and tonemaps each sample before
// averaging - smoothing edges of very bright geometry the hardware resolve cannot handle. The
// render targets are rendered at a reduced resolution (Pixel Scale) to make the per-pixel
// differences visible.

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    Layer,
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
    pixelScale: 4,
    animate: true
});

// ---- scene: a ring of thin, very bright emissive rods rotating over a dark backdrop - high
// contrast HDR edges in motion, the worst case for the hardware box resolve
const rods = [];
const rodColors = [new Color(1, 0.25, 0.05), new Color(0.1, 0.5, 1), new Color(0.9, 0.9, 0.4), new Color(0.3, 1, 0.4)];
for (let i = 0; i < 24; i++) {
    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.emissive = rodColors[i % rodColors.length];
    material.emissiveIntensity = 30;
    material.update();

    const rod = new Entity(`rod${i}`);
    rod.addComponent('render', { type: 'box', material });
    rod.setLocalScale(0.03, 3.5, 0.03);
    rod.setEulerAngles(0, 0, (360 / 24) * i);
    app.root.addChild(rod);
    rods.push(rod);
}

const backdropMaterial = new StandardMaterial();
backdropMaterial.diffuse = Color.BLACK;
backdropMaterial.emissive = new Color(0.02, 0.02, 0.025);
backdropMaterial.update();
const backdrop = new Entity('backdrop');
backdrop.addComponent('render', { type: 'plane', material: backdropMaterial });
backdrop.setLocalScale(30, 1, 30);
backdrop.setPosition(0, 0, -2);
backdrop.setEulerAngles(90, 0, 0);
app.root.addChild(backdrop);

// ---- multisampled render targets, one per resolve technique, both rendering the same scene:
// - msColor: samples are stored (no resolveBuffer) and read by the custom resolve shader
// - msColorHw: samples are hardware-resolved into resolveTex at the end of the render pass
const createTargets = (width, height) => {
    const msColor = new Texture(device, { name: 'msColor', width, height, format: PIXELFORMAT_RGBA16F, samples: 4 });
    const msColorHw = new Texture(device, {
        name: 'msColorHw',
        width,
        height,
        format: PIXELFORMAT_RGBA16F,
        samples: 4
    });
    const resolveTex = new Texture(device, {
        name: 'resolveTex',
        width,
        height,
        format: PIXELFORMAT_RGBA16F,
        mipmaps: false
    });
    const customRt = new RenderTarget({ name: 'customRt', colorBuffer: msColor, depth: true });
    const hwRt = new RenderTarget({ name: 'hwRt', colorBuffer: msColorHw, resolveBuffer: resolveTex, depth: true });
    return { msColor, resolveTex, customRt, hwRt };
};

// the render targets are rendered at a fraction of the canvas resolution (pixelScale) and
// upscaled with no filtering by the compose shader - the individual pixels become visible blocks,
// making the difference between the two resolves obvious even on high-density screens
let currentPixelScale = 0;
const targetSize = () => {
    const scale = data.get('data.pixelScale') ?? 4;
    // the canvas resolution is applied on the first frame, so the device size can still be 0 here
    return [Math.max(1, Math.floor(device.width / scale)), Math.max(1, Math.floor(device.height / scale)), scale];
};

const [initialWidth, initialHeight, initialScale] = targetSize();
currentPixelScale = initialScale;
const targets = createTargets(initialWidth, initialHeight);

const resizeTargets = () => {
    const [width, height, scale] = targetSize();
    currentPixelScale = scale;
    targets.customRt.resize(width, height);
    targets.hwRt.resize(width, height);
};

// ---- two identical cameras rendering the scene into the two targets
const camCustom = new Entity('camCustom');
camCustom.addComponent('camera', { clearColor: new Color(0, 0, 0), priority: 0, renderTarget: targets.customRt });
camCustom.setPosition(0, 0, 5);
app.root.addChild(camCustom);

const camHw = new Entity('camHw');
camHw.addComponent('camera', { clearColor: new Color(0, 0, 0), priority: 1, renderTarget: targets.hwRt });
camHw.setPosition(0, 0, 5);
app.root.addChild(camHw);

// ---- compose pass: a fullscreen shader combining the two techniques side by side
const composeMaterial = new ShaderMaterial({
    uniqueName: 'MsaaCompare',
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
        var hwResolved: texture_2d<f32>;
        uniform uSplit: f32;
        uniform uPixelScale: f32;

        fn tonemap(c: vec3f) -> vec3f {
            return c / (1.0 + c);
        }

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;

            // upscale with no filtering - one render target pixel covers uPixelScale screen pixels
            let dims = vec2i(textureDimensions(hwResolved));
            let coord = min(vec2i(pcPosition.xy / uniform.uPixelScale), dims - vec2i(1));
            let splitX = uniform.uSplit * f32(dims.x) * uniform.uPixelScale;

            var color: vec3f;
            if (pcPosition.x < splitX) {
                // hardware resolve: samples were averaged in linear HDR, tonemap the average
                color = tonemap(textureLoad(hwResolved, coord, 0).rgb);
            } else {
                // custom resolve: tonemap each sample, then average
                let count = i32(textureNumSamples(msColor));
                var sum = vec3f(0.0);
                for (var s = 0; s < count; s++) {
                    sum += tonemap(textureLoad(msColor, coord, s).rgb);
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

const bindTargets = () => {
    composeMaterial.setParameter('msColor', targets.msColor);
    composeMaterial.setParameter('hwResolved', targets.resolveTex);
};
bindTargets();

const composeLayer = new Layer({ name: 'Compose' });
app.scene.layers.push(composeLayer);

const composeQuad = new Entity('composeQuad');
composeQuad.addComponent('render', { type: 'box', material: composeMaterial, layers: [composeLayer.id] });
composeQuad.setLocalScale(10, 10, 1);
app.root.addChild(composeQuad);

const camCompose = new Entity('camCompose');
camCompose.addComponent('camera', { clearColor: new Color(0, 0, 0), priority: 2, layers: [composeLayer.id] });
camCompose.setPosition(0, 0, 3);
app.root.addChild(camCompose);

// keep the render targets in sync with the canvas size and the pixel scale -
// RenderTarget#resize also resizes the multisampled color buffers and the resolve buffer
device.on('resizecanvas', resizeTargets);

// rotate the rods and update the uniforms
let time = 0;
app.on('update', (dt) => {
    if (data.get('data.animate') ?? true) {
        time += dt;
        rods.forEach((rod, i) => {
            rod.setEulerAngles(0, 0, (360 / 24) * i + time * (5 + (i % 5) * 3));
        });
    }

    if ((data.get('data.pixelScale') ?? 4) !== currentPixelScale) {
        resizeTargets();
    }

    composeMaterial.setParameter('uSplit', data.get('data.split') ?? 0.5);
    composeMaterial.setParameter('uPixelScale', currentPixelScale);
});

export { app };
