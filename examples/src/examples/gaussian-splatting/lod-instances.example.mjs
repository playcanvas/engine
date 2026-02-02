// @config DESCRIPTION Demonstrates a grid of Gaussian Splat instances using the LOD system for stable performance, with a custom data stream storing IDs to colorize splats via a color lookup texture.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

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

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// auto resolution: treat DPR >= 2 as high-DPI (drops to half)
const applyResolution = () => {
    const dpr = window.devicePixelRatio || 1;
    device.maxPixelRatio = dpr >= 2 ? dpr * 0.5 : dpr;
};
applyResolution();

// Ensure DPR and canvas are updated when window changes size
const resize = () => {
    applyResolution();
    app.resizeCanvas();
};
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// configuration for grid instances
const GRID_SIZE = 20; // N x N grid
const GRID_SPACING = 2; // spacing between instances in world units

const assets = {
    playbot: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/playbot/lod-meta.json` }),
    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

// Work buffer modifier to write component ID uniform to splatId stream
const workBufferModifier = {
    glsl: `
        uniform uint uComponentId;

        void modifySplatCenter(inout vec3 center) {}
        void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
        void modifySplatColor(vec3 center, inout vec4 color) {
            writeSplatId(uvec4(uComponentId, 0u, 0u, 0u));
        }
    `,
    wgsl: `
        uniform uComponentId: u32;

        fn modifySplatCenter(center: ptr<function, vec3f>) {}
        fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
        fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
            writeSplatId(vec4u(uniform.uComponentId, 0u, 0u, 0u));
        }
    `
};

// Render modifier to read splatId and look up color from texture
// Only colorize splats with y > 0.2 to tint the robot but not the ground
// Cyan splats (low R, high G and B) get 10x brightness boost for bloom
const glslRenderModifier = `
    uniform sampler2D uColorLookup;

    void modifySplatCenter(inout vec3 center) {}
    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
    void modifySplatColor(vec3 center, inout vec4 color) {
        if (center.y > 0.2) {
            // Check if original splat color is bright glowing cyan (very low R, high G and B) - targets robot eyes
            bool isCyan = color.r < 0.15 && color.g > 0.6 && color.b > 0.6 &&
                          (color.g - color.r) > 0.5 && (color.b - color.r) > 0.5;

            // Read component ID from splatId stream, and look up color from color lookup texture
            uint id = loadSplatId().r;
            vec3 tintColor = texelFetch(uColorLookup, ivec2(int(id), 0), 0).rgb;
            color.rgb *= tintColor;

            // Boost brightness for originally cyan splats
            if (isCyan) {
                color.rgb *= 30.0;
            }
        }
    }
`;

const wgslRenderModifier = `
    var uColorLookup: texture_2d<f32>;

    fn modifySplatCenter(center: ptr<function, vec3f>) {}
    fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
    fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
        if (center.y > 0.2) {
            // Check if original splat color is bright glowing cyan (very low R, high G and B) - targets robot eyes
            let isCyan = (*color).r < 0.15 && (*color).g > 0.6 && (*color).b > 0.6 &&
                         ((*color).g - (*color).r) > 0.5 && ((*color).b - (*color).r) > 0.5;

            // Read component ID from splatId stream, and look up color from color lookup texture
            let id = loadSplatId().r;
            let tintColor = textureLoad(uColorLookup, vec2i(i32(id), 0), 0).rgb;
            *color = vec4f((*color).rgb * tintColor, (*color).a);

            // Boost brightness for originally cyan splats
            if (isCyan) {
                *color = vec4f((*color).rgb * 30.0, (*color).a);
            }
        }
    }
`;

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.envAtlas = assets.envatlas.resource;
    app.scene.skyboxMip = 3;

    // Add custom splatId stream to work buffer format (R32U)
    app.scene.gsplat.format.addExtraStreams([
        { name: 'splatId', format: pc.PIXELFORMAT_R32U }
    ]);

    // Create color lookup texture (GRID_SIZE*GRID_SIZE x 1, RGBA32F) with random colors
    const colorTexture = new pc.Texture(device, {
        name: 'ColorLookup',
        width: GRID_SIZE * GRID_SIZE,
        height: 1,
        format: pc.PIXELFORMAT_RGBA32F,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    // Pre-compute random base hues for each component (0 to 1)
    const baseHues = new Float32Array(GRID_SIZE * GRID_SIZE);
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        baseHues[i] = Math.random();
    }

    // HSL to RGB conversion (attempt h in 0-1, s in 0-1, l in 0-1)
    const hslToRgb = (h, s, l) => {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [r, g, b];
    };

    // Set color lookup texture parameter
    app.scene.gsplat.material.setParameter('uColorLookup', colorTexture);

    // Function to apply or remove colorization shader (for both GLSL and WGSL) and adjust exposure
    const applyColorize = (enabled) => {
        if (enabled) {
            app.scene.gsplat.material.getShaderChunks('glsl').set('gsplatModifyVS', glslRenderModifier);
            app.scene.gsplat.material.getShaderChunks('wgsl').set('gsplatModifyVS', wgslRenderModifier);
            app.scene.exposure = 0.2;
        } else {
            app.scene.gsplat.material.getShaderChunks('glsl').delete('gsplatModifyVS');
            app.scene.gsplat.material.getShaderChunks('wgsl').delete('gsplatModifyVS');
            app.scene.exposure = 1.3;
        }
        app.scene.gsplat.material.update();
    };

    // Initialize colorize setting (enabled by default)
    data.set('colorize', data.get('colorize') !== false);
    applyColorize(data.get('colorize'));

    data.on('colorize:set', () => {
        applyColorize(data.get('colorize'));
    });

    // enable rotation-based LOD updates and behind-camera penalty
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 4;

    // internal LOD preset based on platform (7 LOD levels: 0-6)
    const isMobile = pc.platform.mobile;
    if (isMobile) {
        app.scene.gsplat.lodRangeMin = 3;  // skip levels 0, 1, 2
        app.scene.gsplat.lodRangeMax = 6;
    } else {
        app.scene.gsplat.lodRangeMin = 2;  // skip level 0 and 1
        app.scene.gsplat.lodRangeMax = 6;
    }

    // create grid of instances centered around origin on XZ plane
    const half = (GRID_SIZE - 1) * 0.5;
    /**
     * Compute per-LOD distances from a base value.
     * @param {number} base - The base distance in world units.
     * @returns {number[]} The array of distances for LODs 0..6.
     */
    const lodBase = 1.2;
    const lodDistances = [lodBase, lodBase * 2, lodBase * 3, lodBase * 4, lodBase * 5, lodBase * 6, lodBase * 7];

    // Create a grid of playbot instances using unified gsplat component
    let componentIndex = 0;
    for (let z = 0; z < GRID_SIZE; z++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const entity = new pc.Entity(`playbot-${x}-${z}`);
            entity.addComponent('gsplat', {
                asset: assets.playbot,
                unified: true
            });
            const px = (x - half) * GRID_SPACING;
            const pz = (z - half) * GRID_SPACING;
            entity.setLocalPosition(px, 0, pz);
            entity.setLocalEulerAngles(180, 0, 0);
            app.root.addChild(entity);
            const gs = /** @type {any} */ (entity.gsplat);
            gs.lodDistances = lodDistances;
            gs.setParameter('uComponentId', componentIndex);
            gs.setWorkBufferModifier(workBufferModifier);
            componentIndex++;
        }
    }

    // Create a camera with fly controls
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 75,
        toneMapping: pc.TONEMAP_ACES
    });

    camera.setLocalPosition(4, 2.6, 4);
    app.root.addChild(camera);

    camera.addComponent('script');
    const cc = /** @type { CameraControls} */ (camera.script.create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: 1.5,
        moveFastSpeed: 5,
        enableOrbit: false,
        enablePan: false,
        focusPoint: new pc.Vec3(2, 0.6, 0)
    });

    // Add CameraFrame with bloom enabled
    const cameraFrame = new pc.CameraFrame(app, camera.camera);
    cameraFrame.bloom.intensity = 0.015;
    cameraFrame.update();

    // update HUD stats and animate colors every frame
    let currentTime = 0;
    app.on('update', (dt) => {
        currentTime += dt;

        // Animate color texture using HSL hue rotation for saturated colors
        const colorData = colorTexture.lock();
        const hueShift = currentTime * 0.1;  // Rotate hue over time
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const hue = (baseHues[i] + hueShift) % 1.0;
            const rgb = hslToRgb(hue, 1.0, 0.3);  // Full saturation, low lightness
            colorData[i * 4 + 0] = rgb[0];
            colorData[i * 4 + 1] = rgb[1];
            colorData[i * 4 + 2] = rgb[2];
        }
        colorTexture.unlock();

        // stats
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
    });
});

export { app };
