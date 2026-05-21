// @config
// @flag HIDDEN

// Temporary repro: TAA + transparent clear — RT alpha should stay 0 in empty regions when correct.
// Dev sidebar: test / taa-alpha

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const vertGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    uniform mat4 matrix_model;
    varying vec2 uv0;
    void main(void) {
        gl_Position = matrix_model * vec4(vertex_position.xy, 0, 1);
        uv0 = vertex_position.xy + 0.5;
    }
`;

const vertWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    uniform matrix_model: mat4x4f;
    varying uv0: vec2f;
    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniform.matrix_model * vec4f(input.vertex_position.xy, 0.0, 1.0);
        output.uv0 = input.vertex_position.xy + vec2f(0.5);
        return output;
    }
`;

const fragViewGLSL = /* glsl */ `
    varying vec2 uv0;
    uniform sampler2D colorMap;
    void main(void) {
        vec4 t = texture2D(colorMap, uv0);
#ifdef REPRO_VIEW_RGB
        gl_FragColor = vec4(t.rgb, 1.0);
#elif defined(REPRO_VIEW_ALPHA)
        gl_FragColor = vec4(t.a, t.a, t.a, 1.0);
#elif defined(REPRO_VIEW_COMPOSITE)
        // Straight alpha for SRC_ALPHA blending over the display clear (simulates compositing onto a canvas).
        gl_FragColor = vec4(t.rgb, t.a);
#endif
    }
`;

const fragViewWGSL = /* wgsl */ `
    varying uv0: vec2f;
    var colorMap: texture_2d<f32>;
    var colorMapSampler: sampler;
    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let t = textureSample(colorMap, colorMapSampler, input.uv0);
#ifdef REPRO_VIEW_RGB
        output.color = vec4f(t.rgb, 1.0);
#elif defined(REPRO_VIEW_ALPHA)
        output.color = vec4f(t.a, t.a, t.a, 1.0);
#elif defined(REPRO_VIEW_COMPOSITE)
        output.color = vec4f(t.rgb, t.a);
#endif
        return output;
    }
`;

/**
 * Debug view of the scene color texture (`REPRO_VIEW_RGB`, `REPRO_VIEW_ALPHA`, or `REPRO_VIEW_COMPOSITE`).
 *
 * @param {string} defineName - Preprocessor define that selects the fragment branch.
 * @returns {pc.ShaderMaterial} Configured material; set blend on the composite variant if needed.
 */
function createViewMaterial(defineName) {
    const mat = new pc.ShaderMaterial();
    mat.shaderDesc = {
        uniqueName: 'TaaAlphaReproView',
        vertexGLSL: vertGLSL,
        fragmentGLSL: fragViewGLSL,
        vertexWGSL: vertWGSL,
        fragmentWGSL: fragViewWGSL,
        attributes: {
            vertex_position: pc.SEMANTIC_POSITION
        }
    };
    // Match app.drawTexture fallback: fullscreen quads use negative Y scale, so back-face culling
    // would discard the whole quad (default Material.cull is CULLFACE_BACK).
    mat.cull = pc.CULLFACE_NONE;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.setDefine(defineName, true);
    mat.update();
    return mat;
}

const gfxOptions = {
    deviceTypes: [deviceType],
    antialias: false,
    alpha: true
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
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    const worldLayer = app.scene.layers.getLayerByName('World');
    const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
    const uiLayer = app.scene.layers.getLayerByName('UI');

    const rtLayer = new pc.Layer({ name: 'TaaAlphaReproRT' });
    app.scene.layers.insert(rtLayer, 1);

    const cubeMaterial = new pc.StandardMaterial();
    cubeMaterial.diffuse = new pc.Color(0.52, 0.52, 0.52);
    cubeMaterial.gloss = 0.5;
    cubeMaterial.metalness = 0.35;
    cubeMaterial.useMetalness = true;
    cubeMaterial.update();

    /**
     * @param {string} primitiveType - Primitive mesh type (e.g. `'box'`).
     * @param {pc.Vec3} position - World-space position for the new entity.
     * @param {pc.Vec3} scale - Local scale of the primitive.
     * @param {pc.Material} mat - Material assigned to the render component.
     * @returns {pc.Entity} The created entity (already parented under `app.root`).
     */
    function createPrimitive(primitiveType, position, scale, mat) {
        const primitive = new pc.Entity();
        primitive.addComponent('render', {
            type: primitiveType,
            castShadows: true,
            material: mat,
            layers: [rtLayer.id]
        });
        primitive.setLocalPosition(position);
        primitive.setLocalScale(scale);
        app.root.addChild(primitive);
        return primitive;
    }

    const orbitFocus = new pc.Entity('OrbitFocus');
    orbitFocus.setLocalPosition(0, 35, 0);
    app.root.addChild(orbitFocus);

    const numTowers = 8;
    for (let i = 0; i < numTowers; i++) {
        let scale = 12;
        const fraction = (i / numTowers) * Math.PI * 2;
        const radius = 200;
        const numCubes = 12;
        for (let y = 0; y <= 10; y++) {
            const elevationRadius = radius * (1 - y / numCubes);
            const pos = new pc.Vec3(elevationRadius * Math.sin(fraction), y * 6, elevationRadius * Math.cos(fraction));
            const prim = createPrimitive('box', pos, new pc.Vec3(scale, scale, scale), cubeMaterial);
            prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
        }
        scale -= 1.5;
    }

    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        intensity: 1.2,
        castShadows: true,
        shadowDistance: 800,
        shadowResolution: 2048,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        // Default light.layers is [World] only; geometry lives on rtLayer, so it would stay black.
        layers: [rtLayer.id]
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(50, 30, 0);

    app.scene.ambientLight = new pc.Color(0.25, 0.25, 0.28);

    const sceneColorTex = new pc.Texture(device, {
        name: 'TaaAlphaReproSceneColor',
        width: 4,
        height: 4,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    const sceneRt = new pc.RenderTarget({
        name: 'TaaAlphaReproRT',
        colorBuffer: sceneColorTex,
        depth: true,
        flipY: !device.isWebGPU,
        samples: 1
    });

    const sceneCamera = new pc.Entity('SceneCamera');
    sceneCamera.addComponent('camera', {
        layers: [rtLayer.id],
        farClip: 2000,
        nearClip: 0.5,
        priority: -1,
        renderTarget: sceneRt,
        // Fully transparent clear — green is visible only where alpha is preserved
        clearColor: new pc.Color(0, 1, 0, 0)
    });
    app.root.addChild(sceneCamera);
    sceneCamera.setLocalPosition(300 * Math.sin(0.3), 150, 300 * Math.cos(0.3));

    sceneCamera.addComponent('script');
    sceneCamera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: orbitFocus,
            distanceMax: 1200,
            frameOnStart: false
        }
    });
    sceneCamera.script.create('orbitCameraInputMouse');
    sceneCamera.script.create('orbitCameraInputTouch');

    const cameraFrame = new pc.CameraFrame(app, sceneCamera.camera);
    cameraFrame.rendering.renderFormats = [pc.PIXELFORMAT_RGBA8];
    cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
    cameraFrame.rendering.samples = 1;
    cameraFrame.bloom.intensity = 0;
    cameraFrame.taa.jitter = 1;

    const applySettings = () => {
        cameraFrame.taa.enabled = data.get('data.taa.enabled');
        cameraFrame.rendering.renderTargetScale = data.get('data.scene.scale');
        // Sharpen when TAA is on (same idea as graphics/taa.example.mjs); CameraFrame stays active when TAA is off.
        cameraFrame.rendering.sharpness = data.get('data.taa.enabled') ? 1 : 0;
        cameraFrame.update();
    };

    data.on('*:set', () => {
        applySettings();
    });

    data.set('data', {
        scene: {
            scale: 1
        },
        taa: {
            enabled: true
        }
    });

    applySettings();

    const displayCamera = new pc.Entity('DisplayCamera');
    displayCamera.addComponent('camera', {
        layers: [worldLayer.id, skyboxLayer.id, uiLayer.id],
        clearColor: new pc.Color(0.55, 0.35, 0.35, 1),
        farClip: 100,
        nearClip: 0.1,
        priority: 0
    });
    app.root.addChild(displayCamera);

    const matRgb = createViewMaterial('REPRO_VIEW_RGB');
    const matAlpha = createViewMaterial('REPRO_VIEW_ALPHA');
    const matComposite = createViewMaterial('REPRO_VIEW_COMPOSITE');
    matComposite.blendType = pc.BLEND_NORMAL;
    matComposite.setParameter('colorMap', sceneColorTex);
    matRgb.setParameter('colorMap', sceneColorTex);
    matAlpha.setParameter('colorMap', sceneColorTex);
    matComposite.update();
    matRgb.update();
    matAlpha.update();

    const syncSceneRt = () => {
        const { width, height: devHeight } = device;
        if (width < 2 || devHeight < 2) {
            return;
        }
        // drawTexture sizes are in projected units where 2 spans the viewport. The top composite
        // quad uses width=1 and height=width/height, which maps to roughly (width/2)×(width/2)
        // pixels — ~1:1 texels vs on-screen preview instead of full-buffer supersampling.
        const panelPx = Math.max(2, Math.floor(width * 0.5));
        sceneRt.resize(panelPx, panelPx);
        cameraFrame.update();
    };

    syncSceneRt();
    device.on('resizecanvas', syncSceneRt);

    app.on('destroy', () => {
        device.off('resizecanvas', syncSceneRt);
    });

    app.on('update', () => {
        const gd = app.graphicsDevice;
        const ratio = gd.width / gd.height;

        // Bottom panels first (opaque), then top: straight-alpha blended over gray (like a transparent canvas).
        // @ts-ignore engine-tsd
        app.drawTexture(-0.5, -0.5, 0.9, 0.9 * ratio, null, matRgb, worldLayer);

        // @ts-ignore engine-tsd
        app.drawTexture(0.5, -0.5, 0.9, 0.9 * ratio, null, matAlpha, worldLayer);

        // @ts-ignore engine-tsd
        app.drawTexture(0, 0.4, 1, ratio, null, matComposite, worldLayer);
    });
});
