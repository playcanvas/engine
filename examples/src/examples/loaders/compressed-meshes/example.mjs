// @config
//
// Mesh compression shrinks a glTF's geometry so it downloads faster, and the engine decodes it as
// the file loads. This is the same Stanford dragon three ways: uncompressed, compressed with the
// [EXT_meshopt_compression](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression)
// glTF extension by `gltfpack -cc`, and with
// [KHR_draco_mesh_compression](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_draco_mesh_compression).
// Each label shows the file's size and the vertices and triangles it decodes to. Before loading,
// meshopt needs `meshoptInitialize`, and Draco the `DracoDecoderModule` wasm module.
//
// `LMB` / `RMB` Orbit · Hold `Shift` / `MMB` Pan · `Wheel` / `Pinch` Zoom
//
// @credit
// title: Stanford Dragon
// author: Stanford Computer Graphics Laboratory
// source: https://graphics.stanford.edu/data/3Dscanrep/
// license: Stanford 3D Scanning Repository terms (https://graphics.stanford.edu/data/3Dscanrep/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    ELEMENTTYPE_GROUP,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice,
    meshoptInitialize
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// The Draco decoder, loaded up front
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});
await new Promise((resolve) => {
    WasmModule.getInstance('DracoDecoderModule', () => resolve(true));
});

// The meshopt decoder, imported the first time a meshopt compressed file loads
meshoptInitialize({ url: './assets/wasm/meshopt/meshopt_decoder.mjs' });

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// The same model in each format, in the order they stand in the scene
const models = [
    { name: 'Uncompressed', url: './assets/models/stanford-dragon.glb' },
    { name: 'Meshopt', url: './assets/models/stanford-dragon-meshopt.glb' },
    { name: 'Draco', url: './assets/models/stanford-dragon-draco.glb' }
];

// Fetch each file to know its size, and hand its bytes to the asset so it isn't downloaded twice
const loaded = await Promise.all(
    models.map(async ({ name, url }) => {
        const contents = await (await fetch(url)).arrayBuffer();
        return { name, size: contents.byteLength, asset: new Asset(name, 'container', { url, contents }) };
    })
);

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    bold: new Asset('bold', 'font', { url: './assets/fonts/roboto-bold.json' }),
    regular: new Asset('regular', 'font', { url: './assets/fonts/roboto-regular.json' })
};

await new Promise((resolve) => {
    new AssetListLoader([...Object.values(assets), ...loaded.map(({ asset }) => asset)], app.assets).load(resolve);
});

app.start();

app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.4;
app.scene.exposure = 1;

const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    intensity: 1.5
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

// The screen the labels are on
const screen = new Entity('screen');
screen.addComponent('screen', {
    screenSpace: true,
    referenceResolution: [1280, 720],
    scaleMode: SCALEMODE_BLEND,
    scaleBlend: 0.5
});
app.root.addChild(screen);

/**
 * Create an element on a parent, centered on it unless the properties say otherwise.
 *
 * @param {Entity} parent - The parent entity.
 * @param {string} name - The entity name.
 * @param {object} properties - Properties of the element component.
 * @returns {Entity} The entity.
 */
const createElement = (parent, name, properties) => {
    const entity = new Entity(name);
    entity.addComponent('element', { anchor: [0.5, 0.5, 0.5, 0.5], pivot: [0.5, 0.5], ...properties });
    parent.addChild(entity);
    return entity;
};

/**
 * Count the vertices and triangles a container decoded to.
 *
 * @param {Asset<'container'>} asset - The container asset.
 * @returns {{ vertices: number, triangles: number }} The counts.
 */
const countGeometry = (asset) => {
    let vertices = 0;
    let triangles = 0;
    asset.resource.renders.forEach((render) => {
        render.resource.meshes.forEach((mesh) => {
            vertices += mesh.vertexBuffer.numVertices;
            triangles += mesh.primitive[0].count / 3;
        });
    });
    return { vertices, triangles };
};

// Place the models side by side, each with a label under it
const DARK = new Color(0.05, 0.05, 0.07);
const bounds = new BoundingBox(new Vec3(), new Vec3());
const placed = loaded.map(({ name, size, asset }, i) => {
    const entity = asset.resource.instantiateRenderEntity();
    app.root.addChild(entity);
    if (i === 0) {
        entity.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((meshInstance) => bounds.add(meshInstance.aabb));
        });
    }

    // Anchored to the screen's bottom-left corner, with its pivot mid top edge so it hangs below its point
    const { vertices, triangles } = countGeometry(asset);
    const label = createElement(screen, `${name} label`, {
        type: ELEMENTTYPE_GROUP,
        anchor: [0, 0, 0, 0],
        pivot: [0.5, 1],
        width: 220,
        height: 96
    });
    createElement(label, 'name', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.bold.id,
        text: name,
        fontSize: 24,
        outlineColor: DARK,
        outlineThickness: 0.5,
        pivot: [0.5, 1],
        anchor: [0.5, 1, 0.5, 1]
    });
    createElement(label, 'details', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: assets.regular.id,
        text: [
            `${(size / (1024 * 1024)).toFixed(2)} MB`,
            `${vertices.toLocaleString()} vertices`,
            `${triangles.toLocaleString()} triangles`
        ].join('\n'),
        fontSize: 16,
        lineHeight: 20,
        alignment: [0.5, 0],
        color: new Color(0.85, 0.85, 0.85),
        outlineColor: DARK,
        outlineThickness: 0.5,
        pivot: [0.5, 1],
        anchor: [0.5, 1, 0.5, 1]
    }).setLocalPosition(0, -30, 0);
    return { entity, label };
});

// Space the models by their width, centered on the origin
const width = bounds.halfExtents.x * 2;
const spacing = width * 1.35;
placed.forEach(({ entity }, i) => {
    entity.setLocalPosition((i - 1) * spacing, 0, 0);
});

const center = new Vec3(0, bounds.center.y, 0);
const camera = new Entity('camera');
// A horizontal field of view keeps the row in view on any aspect ratio
camera.addComponent('camera', {
    fov: 60,
    horizontalFov: true,
    nearClip: width * 0.01,
    farClip: width * 100,
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.setPosition(0, center.y + width, width * 3.6);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = center;
cameraControls.enableFly = false;
cameraControls.moveSpeed = width * 2;

// Hang each label under its model, converting worldToScreen's CSS pixels to bottom-left screen units
const point = new Vec3();
const view = new Vec3();
const onCanvas = new Vec3();
app.on('update', () => {
    const units = canvas.width / canvas.clientWidth / screen.screen.scale;
    const { x: halfX, z: halfZ } = bounds.halfExtents;
    const bottom = bounds.getMin().y;
    placed.forEach(({ entity, label }) => {
        const { x, z } = entity.getPosition();

        // Under the lowest bottom corner on screen, so the label clears the model from any angle
        let lowest = 0;
        for (const dx of [-halfX, halfX]) {
            for (const dz of [-halfZ, halfZ]) {
                camera.camera.worldToScreen(point.set(x + dx, bottom, z + dz), onCanvas);
                lowest = Math.max(lowest, onCanvas.y);
            }
        }
        camera.camera.worldToScreen(point.set(x, bottom, z), onCanvas);

        // Hide the label when its model is behind the camera
        camera.camera.viewMatrix.transformPoint(point, view);
        label.enabled = view.z < 0;
        label.setLocalPosition(onCanvas.x * units, (canvas.clientHeight - lowest) * units - 8, 0);
    });
});

// Portrait canvases get a portrait reference resolution for the labels
const layout = () => {
    const portrait = device.height > device.width;
    screen.screen.referenceResolution = portrait ? new Vec2(540, 960) : new Vec2(1280, 720);
};
device.on('resizecanvas', layout);
layout();
