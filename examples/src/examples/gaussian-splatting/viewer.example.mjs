// @config
//
// @credit
// title: Wide Street 02
// author: Poly Haven
// source: https://polyhaven.com/a/wide_street_02
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    GSPLATDATA_COMPACT,
    GSPLATDATA_LARGE,
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_111110F,
    PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGBA32F,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_LINEAR,
    TextureHandler,
    TouchDevice,
    Vec2,
    WasmModule,
    createGraphicsDevice,
    math,
    platform
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { SpzParser } from 'playcanvas/scripts/esm/parsers/spz-parser.mjs';

import { data, deviceType, win } from 'examples/context';

/**
 * @import { MeshInstance } from 'playcanvas'
 */

// A scene can also be loaded from a url, entered under the drop instructions or given as a hash
// query param. This includes the streamed level of detail scenes, `lod-meta.json` and XGRIDS
// `.lcc2`, e.g. #/gaussian-splatting/viewer?url=https://example.com/scene/lod-meta.json
const hashQuery = (win.location.hash || window.location.hash || '').split('?')[1] || '';
const paramUrl = new URLSearchParams(hashQuery).get('url');

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up the ZSTD decompression module, used by the spz parser
WasmModule.setConfig('ZstdDecoderModule', {
    glueUrl: './assets/wasm/zstd/zstd.wasm.js',
    wasmUrl: './assets/wasm/zstd/zstd.wasm.wasm'
});

// Create HTML overlay for drop instructions
const dropOverlay = document.createElement('div');
dropOverlay.id = 'drop-overlay';
dropOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 1000;
`;

const dropBox = document.createElement('div');
dropBox.style.cssText = `
    background: rgba(0, 0, 0, 0.45);
    border: 2px dashed rgba(255, 255, 255, 0.6);
    border-radius: 16px;
    padding: 32px 48px;
    font-family: Arial, sans-serif;
    font-size: 24px;
    color: white;
    text-align: center;
    line-height: 1.4;
`;
const dropText = document.createElement('div');
dropText.innerHTML =
    'Drop .ply, .sog, .spz, or .glb file to view<br>or unpacked SOG (meta.json + .webp files)<br>or open a scene from its URL';
dropBox.appendChild(dropText);

// the url field takes clicks and typing, the rest of the overlay lets drops through to the canvas
const urlForm = document.createElement('form');
urlForm.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 20px;
    pointer-events: auto;
`;
const urlInput = document.createElement('input');
urlInput.type = 'text';
urlInput.placeholder = 'https://.../lod-meta.json, .lcc2, .sog, .ply';
urlInput.value = paramUrl || '';
urlInput.style.cssText = `
    flex: 1;
    min-width: 360px;
    padding: 8px 12px;
    font-size: 16px;
    color: white;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 8px;
`;
const urlButton = document.createElement('button');
urlButton.type = 'submit';
urlButton.textContent = 'Open';
urlButton.style.cssText = `
    padding: 8px 20px;
    font-size: 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
`;
urlForm.append(urlInput, urlButton);
dropBox.appendChild(urlForm);
dropOverlay.appendChild(dropBox);
document.body.appendChild(dropOverlay);

const gfxOptions = {
    deviceTypes: [deviceType],
    // Disable antialiasing as CameraFrame handles it
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Register the spz parser with the gsplat resource handler
const gsplatHandler = /** @type {GSplatHandler} */ (app.loader.getHandler('gsplat'));
gsplatHandler.addParser(new SpzParser(app));

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Load HDRI
const assets = {
    hdri: new Asset('hdri', 'texture', { url: './assets/hdri/wide-street.hdr' }, { mipmaps: false })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

let splatEntity = null;

// streamed scenes, as in the streamed-sog example, using all their levels of detail
app.scene.gsplat.lodBehindPenalty = 3;
app.scene.gsplat.lodUpdateDistance = 0.5;
app.scene.gsplat.lodUnderfillLimit = 5;
app.scene.gsplat.minPixelSize = 2;
app.scene.gsplat.minContribution = 2;

/**
 * Calculate the bounding box of an entity.
 *
 * @param {BoundingBox} bbox - The bounding box.
 * @param {Entity} entity - The entity.
 * @returns {BoundingBox} The bounding box.
 */
const calcEntityAABB = (bbox, entity) => {
    bbox.center.set(0, 0, 0);
    bbox.halfExtents.set(0, 0, 0);
    entity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((/** @type {MeshInstance} */ mi) => {
            bbox.add(mi.aabb);
        });
    });
    return bbox;
};

/**
 * The orientation that shows a splat file upright: SPZ stores +Y up, LCC2 +Z up, and the other
 * formats -Y up.
 *
 * @param {string} filename - The file name.
 * @returns {number} The rotation around the x axis, in degrees.
 */
const orientationOf = (filename) => {
    const name = filename.toLowerCase();
    if (name.endsWith('.spz')) return 0;
    if (name.endsWith('.lcc2')) return 270;
    return 180;
};

/**
 * Shows a message in the drop overlay.
 *
 * @param {string} text - The message.
 */
const showError = (text) => {
    dropText.textContent = text;
    dropBox.style.background = 'rgba(180, 50, 50, 0.7)';
    dropOverlay.style.display = 'flex';
};

// Create camera at startup so skydome is visible before dropping files
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0, 0, 0),
    fov: 60,
    farClip: 1000
});
camera.setLocalPosition(0, 2, 5);
app.root.addChild(camera);

// Create directional light for GLB model illumination
const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    intensity: 1,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

// Setup CameraFrame
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_111110F];
cameraFrame.rendering.samples = 1;
cameraFrame.grading.enabled = true;

// Setup skydome toggle function
const applySkydome = () => {
    const oldSkybox = app.scene.skybox;
    const oldEnvAtlas = app.scene.envAtlas;
    const enabled = data.get('data.skydome');
    if (enabled) {
        const hdriTexture = assets.hdri.resource;

        // Generate high resolution cubemap for skybox
        const skybox = EnvLighting.generateSkyboxCubemap(hdriTexture);
        app.scene.skybox = skybox;

        // Generate env-atlas for lighting
        const lighting = EnvLighting.generateLightingSource(hdriTexture);
        const envAtlas = EnvLighting.generateAtlas(lighting);
        lighting.destroy();
        app.scene.envAtlas = envAtlas;
    } else {
        app.scene.skybox = null;
        app.scene.envAtlas = null;
    }

    oldSkybox?.destroy();
    oldEnvAtlas?.destroy();
};

// Rebuild generated textures while preserving the skydome toggle.
device.on('devicerestored', applySkydome);

// Initialize data values
data.set('data', {
    skydome: false,
    compact: false,
    antialias: false,
    // re-evaluate spherical harmonics every frame the camera moves, as with higher SH bands
    // even a degree of stale view direction is visible
    colorUpdateAngle: 0,
    orientation: 180,
    // the most splats a streamed scene renders, in millions; other splats always render in full
    splatBudget: platform.mobile ? 2 : 6,
    tonemapping: TONEMAP_LINEAR,
    grading: {
        exposure: 0, // 0 EV = no change
        contrast: 1
    },
    bloom: {
        enabled: false,
        intensity: 0.03
    },
    colorEnhance: {
        enabled: false,
        shadows: 0,
        highlights: 0,
        midtones: 0,
        vibrance: 0,
        dehaze: 0
    }
});

// Apply initial skydome setting
applySkydome();

// Apply settings function
const applySettings = () => {
    app.scene.gsplat.colorUpdateAngle = data.get('data.colorUpdateAngle');
    app.scene.gsplat.splatBudget = Math.round(data.get('data.splatBudget') * 1000000);

    cameraFrame.rendering.toneMapping = data.get('data.tonemapping');

    // Convert exposure EV (F-stops) to brightness multiplier
    // Each stop doubles or halves brightness: multiplier = 2^(EV)
    const exposureEV = data.get('data.grading.exposure');
    cameraFrame.grading.brightness = Math.pow(2, exposureEV);

    cameraFrame.grading.contrast = data.get('data.grading.contrast');

    // Bloom - only enabled if toggle is on
    const bloomEnabled = data.get('data.bloom.enabled');
    const bloomIntensity = data.get('data.bloom.intensity');
    cameraFrame.bloom.intensity = bloomEnabled ? bloomIntensity : 0;
    if (bloomEnabled) {
        cameraFrame.bloom.blurLevel = 7;
    }

    // Color Enhance
    cameraFrame.colorEnhance.enabled = data.get('data.colorEnhance.enabled');
    cameraFrame.colorEnhance.shadows = data.get('data.colorEnhance.shadows');
    cameraFrame.colorEnhance.highlights = data.get('data.colorEnhance.highlights');
    cameraFrame.colorEnhance.midtones = data.get('data.colorEnhance.midtones');
    cameraFrame.colorEnhance.vibrance = data.get('data.colorEnhance.vibrance');
    cameraFrame.colorEnhance.dehaze = data.get('data.colorEnhance.dehaze');

    cameraFrame.update();
};

// Apply initial settings
applySettings();

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', GSPLAT_RENDERER_AUTO);

/** @type {CameraControls|null} */
let cameraControls = null;

/**
 * Points the camera at a loaded entity, from a distance where its bounds fill the view.
 *
 * @param {Entity} entity - The entity.
 * @param {BoundingBox} aabb - Its bounds, in local space for a gsplat and world space otherwise.
 */
const frameEntity = (entity, aabb) => {
    const center = aabb.center;
    const size = aabb.halfExtents.length() * 2;
    const cameraDistance = size * 2.5;

    // Update camera for the loaded asset
    camera.camera.farClip = size * 10;
    camera.setLocalPosition(center.x, center.y + size * 0.3, center.z + cameraDistance);

    // frame the world space bounds from that direction, at the distance where they fill the view
    const bounds = new BoundingBox();
    if (entity.gsplat) {
        bounds.setFromTransformedAabb(aabb, entity.getWorldTransform());
    } else {
        bounds.copy(aabb);
    }
    const { halfExtents } = bounds;
    const radius = Math.max(halfExtents.x, halfExtents.y, halfExtents.z);
    const fitDistance = (radius * 1.5) / Math.sin(0.5 * camera.camera.fov * math.DEG_TO_RAD);
    camera.setPosition(
        camera.getPosition().clone().sub(bounds.center).normalize().mulScalar(fitDistance).add(bounds.center)
    );

    // Orbit with the left mouse button and the wheel, fly with the right mouse button or WASD and
    // QE, at speeds that suit the size of the scene. Hold shift to fly faster and ctrl slower.
    const settings = {
        zoomRange: new Vec2(0.01, size * 5),
        moveSpeed: size * 0.02,
        moveFastSpeed: size * 0.08,
        moveSlowSpeed: size * 0.005
    };

    // Add camera controls on the first load, and move them to each later one
    if (cameraControls) {
        Object.assign(cameraControls, settings);
        cameraControls.reset(bounds.center, camera.getPosition());
    } else {
        camera.addComponent('script');
        cameraControls = camera.script.create(CameraControls, {
            properties: {
                focusPoint: bounds.center,
                pitchRange: new Vec2(-90, 90),
                ...settings
            }
        });
    }
};

// Setup drag and drop handlers
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
});

canvas.addEventListener('drop', async (e) => {
    e.preventDefault();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Detect unpacked SOG: a meta.json file was dropped (with any number of sibling webp files).
    const metaFile = files.find((f) => f.name.toLowerCase() === 'meta.json');
    const isUnpackedSog = !!metaFile;

    // Otherwise expect a single gsplat/glb file
    const file = files[0];
    const fileName = file.name.toLowerCase();
    const isSpz = !isUnpackedSog && fileName.endsWith('.spz');
    const isGSplat = !isUnpackedSog && (fileName.endsWith('.ply') || fileName.endsWith('.sog') || isSpz);
    const isGlb = !isUnpackedSog && fileName.endsWith('.glb');

    if (!isUnpackedSog && !isGSplat && !isGlb) {
        console.warn('Please drop a .ply, .sog, .spz, .glb, or an unpacked SOG (meta.json + .webp files)');
        return;
    }

    // Hide instructions overlay
    dropOverlay.style.display = 'none';

    let entity;
    let aabb;

    if (isUnpackedSog) {
        // Build a filename -> blob URL map for all sibling files (webp textures).
        // The SogParser will use options.mapUrl to resolve filenames referenced in meta.json.
        const blobMap = new Map();
        for (const f of files) {
            if (f !== metaFile) {
                blobMap.set(f.name, URL.createObjectURL(f));
            }
        }

        const metaBlobUrl = URL.createObjectURL(metaFile);

        // Create gsplat asset manually so we can pass the mapUrl option
        const asset = new Asset(
            metaFile.name,
            'gsplat',
            {
                url: metaBlobUrl,
                filename: metaFile.name
            },
            null,
            {
                // @ts-expect-error mapUrl is an internal option of the sog parser
                mapUrl: (filename) => blobMap.get(filename)
            }
        );

        app.assets.add(asset);

        await new Promise((resolve, reject) => {
            asset.once('load', () => resolve(asset));
            asset.once('error', (err) => reject(err));
            app.assets.load(asset);
        });

        // Create gsplat entity
        entity = new Entity(metaFile.name);
        entity.addComponent('gsplat', {
            asset: asset
        });
        entity.setLocalEulerAngles(180, 0, 0);
        app.root.addChild(entity);

        splatEntity = entity;

        await new Promise((resolve) => {
            requestAnimationFrame(resolve);
        });

        aabb = entity.gsplat.customAabb;
        if (!aabb) {
            console.warn('customAabb not available');
            return;
        }
    } else if (isGSplat) {
        // Create blob URL and load asset using loadFromUrlAndFilename
        // This method is specifically for blob assets where the URL doesn't identify the format
        const blobUrl = URL.createObjectURL(file);

        // Load gaussian splat asset
        const asset = await new Promise((resolve, reject) => {
            app.assets.loadFromUrlAndFilename(blobUrl, file.name, 'gsplat', (err, loadedAsset) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(loadedAsset);
                }
            });
        });

        // Create gsplat entity
        entity = new Entity(file.name);
        entity.addComponent('gsplat', {
            asset: asset
        });

        const orientation = orientationOf(file.name);
        entity.setLocalEulerAngles(orientation, 0, 0);
        app.root.addChild(entity);

        // Store reference for orientation updates and sync the orientation control
        splatEntity = entity;
        data.set('data.orientation', orientation);

        // Wait a frame for customAabb to be available
        await new Promise((resolve) => {
            requestAnimationFrame(resolve);
        });

        // Get bounds for framing
        aabb = entity.gsplat.customAabb;
        if (!aabb) {
            console.warn('customAabb not available');
            return;
        }
    } else {
        // Load GLB container asset
        const blobUrl = URL.createObjectURL(file);
        let asset;
        try {
            asset = await new Promise((resolve, reject) => {
                app.assets.loadFromUrlAndFilename(blobUrl, file.name, 'container', (err, loadedAsset) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(loadedAsset);
                    }
                });
            });
        } catch (err) {
            console.error('Failed to load GLB:', err);
            // Draco/Basis compressed files are not supported
            showError('Failed to load GLB (compressed formats not supported)');
            return;
        }

        // Instantiate GLB entity
        entity = asset.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        // Calculate bounds from mesh instances
        aabb = calcEntityAABB(new BoundingBox(), entity);
    }

    frameEntity(entity, aabb);
});

// Load a gsplat scene from a url, replacing the one loaded from the previous url
/** @type {{ entity: Entity, asset: Asset } | null} */
let urlScene = null;
const loadUrl = async (/** @type {string} */ url) => {
    if (!url) return;
    dropOverlay.style.display = 'none';

    const filename = new URL(url, window.location.href).pathname.split('/').pop() || url;
    const asset = new Asset(filename, 'gsplat', { url });
    app.assets.add(asset);
    try {
        await new Promise((resolve, reject) => {
            asset.once('load', resolve);
            asset.once('error', reject);
            app.assets.load(asset);
        });
    } catch (err) {
        console.error(`Failed to load ${url}:`, err);
        app.assets.remove(asset);
        showError(`Failed to load ${filename}`);
        return;
    }

    if (urlScene) {
        urlScene.entity.destroy();
        app.assets.remove(urlScene.asset);
        urlScene.asset.unload();
    }

    const entity = new Entity(filename);
    entity.addComponent('gsplat', { asset });
    const orientation = orientationOf(filename);
    entity.setLocalEulerAngles(orientation, 0, 0);
    app.root.addChild(entity);
    urlScene = { entity, asset };

    splatEntity = entity;
    data.set('data.orientation', orientation);

    // Wait a frame for customAabb to be available
    await new Promise((resolve) => {
        requestAnimationFrame(resolve);
    });
    frameEntity(entity, entity.gsplat.customAabb);
};

// Listen for changes
data.on('*:set', (/** @type {string} */ path) => {
    if (path === 'data.skydome') {
        applySkydome();
    } else if (path === 'data.compact') {
        app.scene.gsplat.dataFormat = data.get('data.compact') ? GSPLATDATA_COMPACT : GSPLATDATA_LARGE;
    } else if (path === 'data.antialias') {
        app.scene.gsplat.antiAlias = data.get('data.antialias');
    } else if (path === 'data.orientation') {
        // Apply orientation to splat entity
        if (splatEntity) {
            const orientation = data.get('data.orientation');
            splatEntity.setLocalEulerAngles(orientation, 0, 0);
        }
    } else {
        applySettings();
    }
});

urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loadUrl(urlInput.value.trim());
});

if (paramUrl) {
    loadUrl(paramUrl);
}
