// @config
//
// Visual regression test for StandardMaterial texture transform grouping. Three channel-isolated
// arrows show the diffuse, opacity and emissive inputs next to their combined output. Toggle exact
// shared transforms or subpixel-distinct transforms while inspecting TRACEID_SHADER_ALLOC.
//
// @flag HIDDEN
// @flag ENGINE=debug

import {
    ADDRESS_REPEAT,
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    CULLFACE_NONE,
    Entity,
    FILTER_LINEAR,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    Texture,
    TouchDevice,
    TRACEID_SHADER_ALLOC,
    Tracing,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

const textureSize = 256;

/**
 * Traces the asymmetric arrow shared by all test textures.
 *
 * @param {CanvasRenderingContext2D} context - Drawing context.
 */
const traceArrow = (context) => {
    context.beginPath();
    context.moveTo(128, 18);
    context.lineTo(224, 112);
    context.lineTo(174, 112);
    context.lineTo(174, 224);
    context.lineTo(82, 224);
    context.lineTo(82, 112);
    context.lineTo(32, 112);
    context.closePath();
};

/**
 * Creates a repeatable canvas-backed texture.
 *
 * @param {string} name - Texture name.
 * @param {(context: CanvasRenderingContext2D) => void} draw - Canvas drawing callback.
 * @param {boolean} srgb - Whether the texture contains sRGB color data.
 * @returns {Texture} The texture.
 */
const createTexture = (name, draw, srgb) => {
    const source = document.createElement('canvas');
    source.width = textureSize;
    source.height = textureSize;
    const context = /** @type {CanvasRenderingContext2D} */ (source.getContext('2d'));
    draw(context);

    const texture = new Texture(device, {
        name,
        width: textureSize,
        height: textureSize,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        srgb
    });
    texture.setSource(source);
    return texture;
};

const diffuseTexture = createTexture(
    'transform-diffuse',
    (context) => {
        context.fillStyle = '#14171f';
        context.fillRect(0, 0, textureSize, textureSize);

        context.save();
        traceArrow(context);
        context.clip();

        const half = textureSize * 0.5;
        const colors = ['#e74c3c', '#2ecc71', '#3498db', '#f1c40f'];
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                context.fillStyle = colors[x + y * 2];
                context.fillRect(x * half, y * half, half, half);
            }
        }
        context.restore();

        traceArrow(context);
        context.lineWidth = 14;
        context.strokeStyle = '#101820';
        context.stroke();

        context.fillStyle = '#101820';
        context.font = 'bold 34px sans-serif';
        context.textAlign = 'center';
        context.fillText('UV', 128, 175);
    },
    true
);

const opacityTexture = createTexture(
    'transform-opacity',
    (context) => {
        context.fillStyle = '#000';
        context.fillRect(0, 0, textureSize, textureSize);
        traceArrow(context);
        context.fillStyle = '#fff';
        context.fill();
    },
    false
);

const emissiveTexture = createTexture(
    'transform-emissive',
    (context) => {
        context.fillStyle = '#000';
        context.fillRect(0, 0, textureSize, textureSize);
        traceArrow(context);
        context.fillStyle = '#202020';
        context.fill();
        context.beginPath();
        context.arc(128, 58, 20, 0, Math.PI * 2);
        context.fillStyle = '#fff';
        context.fill();
    },
    true
);

const diffuseMaterial = new StandardMaterial();
diffuseMaterial.name = 'Diffuse Source Material';
diffuseMaterial.diffuse = Color.WHITE;
diffuseMaterial.diffuseMap = diffuseTexture;
diffuseMaterial.cull = CULLFACE_NONE;

const opacityMaterial = new StandardMaterial();
opacityMaterial.name = 'Opacity Source Material';
opacityMaterial.diffuse = Color.WHITE;
opacityMaterial.opacityMap = opacityTexture;
opacityMaterial.opacityMapChannel = 'r';
opacityMaterial.alphaTest = 0.5;
opacityMaterial.cull = CULLFACE_NONE;

const emissiveMaterial = new StandardMaterial();
emissiveMaterial.name = 'Emissive Source Material';
emissiveMaterial.diffuse = new Color(0, 0, 0);
emissiveMaterial.emissive = Color.WHITE;
emissiveMaterial.emissiveMap = emissiveTexture;
emissiveMaterial.emissiveIntensity = 2;
emissiveMaterial.cull = CULLFACE_NONE;

const combinedMaterial = new StandardMaterial();
combinedMaterial.name = 'Combined Transform Grouping Material';
combinedMaterial.diffuse = Color.WHITE;
combinedMaterial.diffuseMap = diffuseTexture;
combinedMaterial.opacityMap = opacityTexture;
combinedMaterial.opacityMapChannel = 'r';
combinedMaterial.alphaTest = 0.5;
combinedMaterial.emissive = Color.WHITE;
combinedMaterial.emissiveMap = emissiveTexture;
combinedMaterial.emissiveIntensity = 2;
combinedMaterial.cull = CULLFACE_NONE;

const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.42, 0.44, 0.48);
groundMaterial.gloss = 0.25;
groundMaterial.update();

const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'plane',
    material: groundMaterial,
    castShadows: false,
    receiveShadows: true
});
ground.setLocalScale(12, 1, 10);
app.root.addChild(ground);

const displays = [
    { name: 'Diffuse Source', material: diffuseMaterial },
    { name: 'Opacity Source', material: opacityMaterial },
    { name: 'Emissive Source', material: emissiveMaterial },
    { name: 'Combined Output', material: combinedMaterial }
];
const positions = [-3.6, -1.4, 0.8, 3.4];
for (let i = 0; i < displays.length; i++) {
    const display = displays[i];
    const card = new Entity(display.name);
    card.addComponent('render', {
        type: 'plane',
        material: display.material,
        castShadows: display.material === combinedMaterial,
        receiveShadows: false
    });
    card.setLocalPosition(positions[i], 1.75, 0);
    card.setLocalEulerAngles(90, 0, 0);
    card.setLocalScale(1.7, 1, 2.3);
    app.root.addChild(card);
}

const light = new Entity('Directional Light');
light.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    intensity: 2.2,
    castShadows: true,
    shadowDistance: 18,
    shadowResolution: 2048
});
light.setLocalEulerAngles(48, -32, 0);
app.root.addChild(light);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.08, 0.09, 0.12),
    farClip: 40,
    fov: 48
});
camera.setLocalPosition(0, 4.1, 10.8);
camera.lookAt(new Vec3(0, 1.4, 0));
app.root.addChild(camera);

const overlay = document.createElement('div');
overlay.style.cssText = [
    'position:absolute',
    'right:14px',
    'bottom:14px',
    'max-width:440px',
    'padding:10px 12px',
    'border-radius:4px',
    'background:rgba(0,0,0,0.72)',
    'color:#fff',
    'font:13px/1.45 monospace',
    'pointer-events:none',
    'white-space:pre-line'
].join(';');
document.body.appendChild(overlay);

data.set('data', {
    sameTransforms: true,
    animate: false,
    traceShaderAlloc: true
});

const slots = ['diffuse', 'opacity', 'emissive'];
const sourceMaterials = [diffuseMaterial, opacityMaterial, emissiveMaterial];
const baseTiling = [0.94, 0.92];
const baseOffset = [0.04, 0.05];
const baseRotation = 4;
const separateOffset = 0.0001;

/**
 * Applies the selected transform grouping and optional value animation.
 *
 * @param {boolean} sameTransforms - Whether all texture slots share one transform.
 * @param {number} time - Animation time.
 */
const applyTransforms = (sameTransforms, time) => {
    const scaleWave = Math.sin(time * 0.8) * 0.025;
    const offsetX = Math.sin(time * 0.55) * 0.025;
    const offsetY = Math.cos(time * 0.7) * 0.02;

    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const materialOffset = sameTransforms ? 0 : i * separateOffset;
        const tilingX = baseTiling[0] + scaleWave;
        const tilingY = baseTiling[1] + scaleWave;
        const mapOffsetX = baseOffset[0] + offsetX + materialOffset;
        const mapOffsetY = baseOffset[1] + offsetY;

        combinedMaterial[`${slot}MapTiling`].set(tilingX, tilingY);
        combinedMaterial[`${slot}MapOffset`].set(mapOffsetX, mapOffsetY);
        combinedMaterial[`${slot}MapRotation`] = baseRotation;

        const sourceMaterial = sourceMaterials[i];
        sourceMaterial[`${slot}MapTiling`].set(tilingX, tilingY);
        sourceMaterial[`${slot}MapOffset`].set(mapOffsetX, mapOffsetY);
        sourceMaterial[`${slot}MapRotation`] = baseRotation;
        sourceMaterial.update();
    }

    combinedMaterial.update();
};

let previousSameTransforms = data.get('data.sameTransforms');
let previousAnimate = data.get('data.animate');
let previousTrace = data.get('data.traceShaderAlloc');
let animationTime = 0;

Tracing.set(TRACEID_SHADER_ALLOC, previousTrace);
applyTransforms(previousSameTransforms, animationTime);

app.on('update', (dt) => {
    const sameTransforms = data.get('data.sameTransforms');
    const animate = data.get('data.animate');
    const trace = data.get('data.traceShaderAlloc');

    if (trace !== previousTrace) {
        previousTrace = trace;
        Tracing.set(TRACEID_SHADER_ALLOC, trace);
    }

    if (sameTransforms !== previousSameTransforms || animate !== previousAnimate) {
        previousSameTransforms = sameTransforms;
        previousAnimate = animate;
        animationTime = 0;
        applyTransforms(sameTransforms, animationTime);
    } else if (animate) {
        animationTime += dt;
        applyTransforms(sameTransforms, animationTime);
    }

    const groupCount = sameTransforms ? 1 : slots.length;
    overlay.textContent =
        'DIFFUSE + OPACITY + EMISSIVE = COMBINED\n\n' +
        `MODE: ${sameTransforms ? 'SHARED' : 'SEPARATE'} (${groupCount} transform group${groupCount === 1 ? '' : 's'})\n` +
        `ANIMATION: ${animate ? 'ON' : 'OFF'}\n\n` +
        'Both modes should produce the same aligned result.\n' +
        `Separate mode offsets channels by ${separateOffset}.\n\n` +
        'Open the console for ShaderAlloc traces.\n' +
        'Changing grouping can allocate a shader once;\n' +
        'animation should never allocate one.';
});

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    Tracing.set(TRACEID_SHADER_ALLOC, false);
    overlay.remove();
    diffuseTexture.destroy();
    opacityTexture.destroy();
    emissiveTexture.destroy();
});

app.start();
