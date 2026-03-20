// @config DESCRIPTION Gaussian Splat with Order-Independent Rendering (OIR) prototype.
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const basketballUrl = 'https://code.playcanvas.com/examples_data/example_basketball_02/111.compressed.ply';
const residentEvilUrl = 'https://d28zzqy0iyovbz.cloudfront.net/67841e9d/v1/meta.json';
const handbagUrl = 'https://d28zzqy0iyovbz.cloudfront.net/5ae08cd5/v1/meta.json';
const sushiUrl = 'https://d28zzqy0iyovbz.cloudfront.net/53b8f3d3/v1/meta.json';

const presets = [
    {
        name: 'Basketball',
        depthAlpha: 0.05,
        models: [
            { url: basketballUrl, scale: 1.0 },
            { url: basketballUrl, scale: 0.8 }
        ]
    },
    {
        name: 'Resident Evil',
        depthAlpha: 0.05,
        models: [
            { url: residentEvilUrl, scale: 0.08 }
        ]
    },
    {
        name: 'Handbag',
        depthAlpha: 0.3,
        models: [
            { url: handbagUrl, scale: 2.5 }
        ]
    },
    {
        name: 'Sushi',
        depthAlpha: 0.1,
        models: [
            { url: sushiUrl, scale: 0.1 }
        ]
    }
];

// --- UI controls at bottom ---
const controlsContainer = document.createElement('div');
controlsContainer.style.cssText = 'position:absolute;bottom:40px;left:50%;transform:translateX(-50%);z-index:100;background:rgba(0,0,0,0.6);padding:8px 16px;border-radius:6px;display:flex;align-items:center;gap:14px;font:13px sans-serif;color:#fff;';

const dropdown = document.createElement('select');
dropdown.style.cssText = 'font:13px sans-serif;padding:2px 6px;border-radius:4px;';
for (const preset of presets) {
    const opt = document.createElement('option');
    opt.textContent = preset.name;
    dropdown.appendChild(opt);
}
controlsContainer.appendChild(dropdown);

const sliderLabel = document.createElement('span');
sliderLabel.textContent = 'Falloff: 50';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '1';
slider.max = '200';
slider.value = '50';
slider.style.width = '200px';
controlsContainer.appendChild(sliderLabel);
controlsContainer.appendChild(slider);

const depthAlphaLabel = document.createElement('span');
depthAlphaLabel.textContent = 'Depth Alpha: 0.30';
const depthAlphaSlider = document.createElement('input');
depthAlphaSlider.type = 'range';
depthAlphaSlider.min = '0';
depthAlphaSlider.max = '100';
depthAlphaSlider.value = '30';
depthAlphaSlider.style.width = '150px';
controlsContainer.appendChild(depthAlphaLabel);
controlsContainer.appendChild(depthAlphaSlider);

document.body.appendChild(controlsContainer);

for (const evt of ['mousedown', 'mousemove', 'mouseup', 'pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend']) {
    controlsContainer.addEventListener(evt, e => e.stopPropagation());
}

// Resolve pass: reads two MRT textures (accumulation + log transmittance) and computes WBOIT output.
class RenderPassOIRResolve extends pc.RenderPassShaderQuad {
    bgColor = new Float32Array([0.2, 0.2, 0.2]);

    constructor(device, accumTexture, transmTexture) {
        super(device);
        this.accumTexture = accumTexture;
        this.transmTexture = transmTexture;

        this.shader = pc.ShaderUtils.createShader(device, {
            uniqueName: 'OIRResolveShader',
            attributes: { aPosition: pc.SEMANTIC_POSITION },
            vertexChunk: 'quadVS',

            fragmentGLSL: /* glsl */ `
                uniform sampler2D accumTexture;
                uniform sampler2D transmTexture;
                uniform vec3 bgColor;
                varying vec2 uv0;

                void main() {
                    vec4 accum = texture2D(accumTexture, uv0);
                    float logT = texture2D(transmTexture, uv0).r;

                    float T = exp(logT);
                    vec3 avgColor = accum.rgb / max(accum.a, 1e-5);
                    gl_FragColor = vec4(avgColor * (1.0 - T) + bgColor * T, 1.0);
                }
            `,

            fragmentWGSL: /* wgsl */ `
                var accumTexture: texture_2d<f32>;
                var accumTextureSampler: sampler;
                var transmTexture: texture_2d<f32>;
                var transmTextureSampler: sampler;
                uniform bgColor: vec3f;
                varying uv0: vec2f;

                @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                    var output: FragmentOutput;
                    let accum: vec4f = textureSample(accumTexture, accumTextureSampler, uv0);
                    let logT: f32 = textureSample(transmTexture, transmTextureSampler, uv0).r;

                    let T: f32 = exp(logT);
                    let avgColor: vec3f = accum.rgb / max(accum.a, 1e-5);
                    output.color = vec4f(avgColor * (1.0 - T) + uniform.bgColor * T, 1.0);
                    return output;
                }
            `
        });
    }

    execute() {
        this.device.scope.resolve('accumTexture').setValue(this.accumTexture);
        this.device.scope.resolve('transmTexture').setValue(this.transmTexture);
        this.device.scope.resolve('bgColor').setValue(this.bgColor);
        super.execute();
    }
}

const gfxOptions = {
    deviceTypes: [deviceType],
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES,
        nearClip: 0.5,
        farClip: 20
    });
    camera.setLocalPosition(0, 1.0, 4.2);

    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 60,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    camera.script.on('create:orbitCamera', (scriptInstance) => {
        scriptInstance.once('postInitialize', () => {
            const orbitTarget = new pc.Vec3(0, 1.0, 0);
            scriptInstance.resetAndLookAtPoint(camera.getPosition(), orbitTarget);
        });
    });

    // --- Depth range texture (R32F, cleared to large value, MIN blend finds nearest depth) ---
    const depthRangeTexture = new pc.Texture(device, {
        name: 'OIR-DepthRange',
        width: 4,
        height: 4,
        format: pc.PIXELFORMAT_R32F,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    const depthRangeTarget = new pc.RenderTarget({
        colorBuffer: depthRangeTexture,
        depth: true
    });

    // --- MRT: two RGBA32F textures for OIR accumulation ---
    const accumTexture = new pc.Texture(device, {
        name: 'OIR-Accum',
        width: 4,
        height: 4,
        format: pc.PIXELFORMAT_RGBA32F,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    const transmTexture = new pc.Texture(device, {
        name: 'OIR-Transm',
        width: 4,
        height: 4,
        format: pc.PIXELFORMAT_RGBA32F,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    const oirTarget = new pc.RenderTarget({
        colorBuffers: [accumTexture, transmTexture],
        depth: true
    });

    // --- Layer for depth prepass (separate from World) ---
    const depthLayer = new pc.Layer({ name: 'OIR-Depth' });
    app.scene.layers.push(depthLayer);
    camera.camera.layers = [...camera.camera.layers, depthLayer.id];

    // --- Pass 0: Depth range prepass (MIN blend → R32F) ---
    const depthPass = new pc.RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
    depthPass.init(depthRangeTarget, { resizeSource: null });
    depthPass.addLayer(camera.camera, depthLayer, true);

    const depthPassUpdateClears = depthPass.updateClears.bind(depthPass);
    depthPass.updateClears = function () {
        depthPassUpdateClears();
        this.setClearColor(new pc.Color(1e30, 0, 0, 0));
    };

    // --- Pass 1: Render gsplat to MRT with additive blending ---
    const worldLayer = app.scene.layers.getLayerByName('World');

    const accumPass = new pc.RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
    accumPass.init(oirTarget, { resizeSource: null });
    accumPass.addLayer(camera.camera, worldLayer, false);
    accumPass.addLayer(camera.camera, worldLayer, true);

    const accumPassUpdateClears = accumPass.updateClears.bind(accumPass);
    accumPass.updateClears = function () {
        accumPassUpdateClears();
        this.setClearColor(new pc.Color(0, 0, 0, 0));
    };

    // --- Pass 2: Resolve OIR to framebuffer ---
    const resolvePass = new RenderPassOIRResolve(app.graphicsDevice, accumTexture, transmTexture);
    resolvePass.init(null);

    camera.camera.framePasses = [depthPass, accumPass, resolvePass];

    // --- Entity management ---
    const splatEntities = [];
    const setupDone = new Set();
    const assetCache = new Map();

    function getOrLoadAsset(url) {
        if (!assetCache.has(url)) {
            const asset = new pc.Asset('gsplat', 'gsplat', { url });
            app.assets.add(asset);
            assetCache.set(url, asset);
        }
        return assetCache.get(url);
    }

    function destroySplatEntities() {
        for (const entity of splatEntities) {
            const instance = entity.gsplat?.instance;
            if (instance?.depthMeshInstance) {
                depthLayer.removeMeshInstances([instance.depthMeshInstance]);
            }
            entity.destroy();
        }
        splatEntities.length = 0;
        setupDone.clear();
    }

    function loadPreset(preset) {
        destroySplatEntities();

        const da = preset.depthAlpha ?? 0.3;
        depthAlphaSlider.value = String(Math.round(da * 100));
        depthAlphaLabel.textContent = `Depth Alpha: ${da.toFixed(2)}`;

        const assetsToLoad = preset.models.map(m => getOrLoadAsset(m.url));
        const loader = new pc.AssetListLoader(assetsToLoad, app.assets);
        loader.load(() => {
            const count = preset.models.length;
            preset.models.forEach((model, i) => {
                const entity = new pc.Entity();
                entity.addComponent('gsplat', {
                    asset: assetCache.get(model.url),
                    unified: false,
                    oir: true
                });
                const xOffset = count > 1 ? (i - (count - 1) / 2) * 1.0 : 0;
                entity.setLocalPosition(xOffset, -0.5, 0);
                entity.setLocalEulerAngles(180, 90, 0);
                const s = model.scale;
                entity.setLocalScale(s, s, s);
                app.root.addChild(entity);
                splatEntities.push(entity);
            });
        });
    }

    function applyFalloff(val) {
        for (const entity of splatEntities) {
            const inst = entity.gsplat?.instance;
            if (inst) inst.material.setParameter('oirFalloff', val);
        }
    }

    function applyDepthAlpha(val) {
        for (const entity of splatEntities) {
            const depthMi = entity.gsplat?.instance?.depthMeshInstance;
            if (depthMi) depthMi.material.setParameter('alphaClip', val);
        }
    }

    slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        sliderLabel.textContent = `Falloff: ${val}`;
        applyFalloff(val);
    });

    depthAlphaSlider.addEventListener('input', () => {
        const val = parseFloat(depthAlphaSlider.value) / 100;
        depthAlphaLabel.textContent = `Depth Alpha: ${val.toFixed(2)}`;
        applyDepthAlpha(val);
    });

    dropdown.addEventListener('change', () => {
        loadPreset(presets[dropdown.selectedIndex]);
    });

    app.on('prerender', () => {
        for (const entity of splatEntities) {
            if (setupDone.has(entity)) continue;
            const instance = entity.gsplat?.instance;
            if (!instance?.depthMeshInstance) continue;

            depthLayer.addMeshInstances([instance.depthMeshInstance]);
            instance.material.setParameter('oirDepthRange', depthRangeTexture);
            instance.material.setParameter('oirFalloff', parseFloat(slider.value));
            instance.depthMeshInstance.material.setParameter('alphaClip', parseFloat(depthAlphaSlider.value) / 100);
            setupDone.add(entity);
        }
    });

    loadPreset(presets[0]);
});

export { app };
