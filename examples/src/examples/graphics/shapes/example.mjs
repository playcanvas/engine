import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    EnvLighting,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_SRGBA8,
    RENDERSTYLE_WIREFRAME,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RoundedBoxGeometry,
    SHADOW_PCSS_32F,
    SKYTYPE_DOME,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { ShadowCatcher } from 'playcanvas/scripts/esm/shadow-catcher.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
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
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

const assets = {
    hdri: new Asset('hdri', 'texture', { url: './assets/hdri/wide-street.hdr' }, { mipmaps: false })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Use the HDRI for the skybox, and for the lighting and reflections
const applyHdri = (/** @type {Texture} */ source) => {
    app.scene.skybox = EnvLighting.generateSkyboxCubemap(source);
    const lighting = EnvLighting.generateLightingSource(source);
    app.scene.envAtlas = EnvLighting.generateAtlas(lighting);
    lighting.destroy();
};
applyHdri(assets.hdri.resource);

// When the device is lost, the skybox textures need to be regenerated from the HDRI
device.on('devicerestored', () => {
    applyHdri(assets.hdri.resource);
});

// Project the skybox onto a dome, so the shapes stand on the street
app.scene.exposure = 0.7;
app.scene.sky.type = SKYTYPE_DOME;
app.scene.sky.node.setLocalScale(new Vec3(30, 30, 30));
app.scene.sky.center = new Vec3(0, 0.05, 0);

// A UV test texture: an 8x8 grid of cells, with the hue changing along u and each cell labelled with
// its column and row, so the orientation and any stretching of the UVs are easy to see
const cells = 8;
const cellSize = 64;
const gridCanvas = document.createElement('canvas');
gridCanvas.width = gridCanvas.height = cells * cellSize;
const context = /** @type {CanvasRenderingContext2D} */ (gridCanvas.getContext('2d'));
context.font = `bold ${cellSize * 0.3}px sans-serif`;
context.textAlign = 'center';
context.textBaseline = 'middle';
for (let column = 0; column < cells; column++) {
    for (let row = 0; row < cells; row++) {
        context.fillStyle = `hsl(${(column * 360) / cells}, 70%, ${(column + row) % 2 ? 45 : 65}%)`;
        context.fillRect(column * cellSize, row * cellSize, cellSize, cellSize);
        context.fillStyle = '#000000';
        context.fillText(`${column},${row}`, (column + 0.5) * cellSize, (row + 0.5) * cellSize);
    }
}

const uvTexture = new Texture(device, {
    name: 'uv-grid',
    width: gridCanvas.width,
    height: gridCanvas.height,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: true,
    anisotropy: 8
});
uvTexture.setSource(gridCanvas);

data.set('settings', {
    texture: false,
    wireframe: false,
    metalness: 0.9,
    gloss: 0.9,
    radius: 0.2,
    radiusSegments: 8
});

// The shapes in two rows, the front one first, each in its own metal: silver, gold, copper, and
// anodized aluminium in a few colors. All render component primitive shape types are included. The
// rounded box is not one of them, so its mesh is generated from a RoundedBoxGeometry.
/** @type {{ type: RenderComponent['type'] | 'rounded-box', color: Color }[][]} */
const rows = [
    [
        { type: 'box', color: new Color(0.95, 0.94, 0.91) },
        { type: 'rounded-box', color: new Color(1, 0.77, 0.34) },
        { type: 'plane', color: new Color(0.95, 0.64, 0.54) },
        { type: 'cone', color: new Color(0.25, 0.45, 0.9) }
    ],
    [
        { type: 'cylinder', color: new Color(0.85, 0.2, 0.25) },
        { type: 'sphere', color: new Color(0.95, 0.94, 0.91) },
        { type: 'capsule', color: new Color(0.25, 0.7, 0.45) }
    ]
];

// An unlit material for the wireframes
const wireframeMaterial = new StandardMaterial();
wireframeMaterial.useLighting = false;
wireframeMaterial.useSkybox = false;
wireframeMaterial.diffuse = Color.BLACK;
wireframeMaterial.emissive = new Color(0.9, 0.9, 0.9);
wireframeMaterial.update();

/** @type {StandardMaterial[]} */
const materials = [];

/** @type {Entity[]} */
const wireframes = [];

const roundedBox = new Entity('rounded-box');
const roundedBoxMaterial = new StandardMaterial();
const roundedBoxWireframe = new Entity('wireframe');

// Draw the wireframe of a mesh, using an entity rendering in the wireframe style
const setWireframeMesh = (/** @type {Entity} */ wireframe, /** @type {Mesh} */ mesh) => {
    wireframe.render.meshInstances = [new MeshInstance(mesh, wireframeMaterial)];
};

// Regenerate the rounded box mesh when its settings change. Replacing the mesh instances of the box
// and of its wireframe destroys the previous mesh.
const updateRoundedBox = () => {
    const geometry = new RoundedBoxGeometry({
        radius: data.get('settings.radius'),
        radiusSegments: data.get('settings.radiusSegments')
    });
    const mesh = Mesh.fromGeometry(device, geometry);
    roundedBox.render.meshInstances = [new MeshInstance(mesh, roundedBoxMaterial)];
    setWireframeMesh(roundedBoxWireframe, mesh);
};

rows.forEach((row, rowIndex) => {
    row.forEach(({ type, color }, index) => {
        const rounded = type === 'rounded-box';
        const entity = rounded ? roundedBox : new Entity(type);
        const material = rounded ? roundedBoxMaterial : new StandardMaterial();

        // The wireframe is drawn over the shape, scaled up a little so the surface does not hide its
        // lines, which works as all the shapes are convex. It is also lifted a little for the plane.
        const wireframe = rounded ? roundedBoxWireframe : new Entity('wireframe');
        wireframe.addComponent('render', {
            castShadows: false,
            renderStyle: RENDERSTYLE_WIREFRAME
        });
        wireframe.setLocalScale(1.002, 1.002, 1.002);
        wireframe.setLocalPosition(0, 0.002, 0);
        entity.addChild(wireframe);
        wireframes.push(wireframe);

        if (rounded) {
            entity.addComponent('render');
            updateRoundedBox();
        } else {
            entity.addComponent('render', {
                type: type,
                material: material
            });
            setWireframeMesh(wireframe, entity.render.meshInstances[0].mesh);
        }

        material.useMetalness = true;
        material.diffuse = color;
        materials.push(material);

        // Stand the shape on the ground, centering each row. The plane is lifted a little, to stay
        // above the ground of the dome and the shadow catcher.
        const min = entity.render.meshInstances[0].mesh.aabb.getMin();
        entity.setLocalPosition((index - (row.length - 1) / 2) * 1.6, Math.max(-min.y, 0.02), rowIndex ? -1 : 1);
        app.root.addChild(entity);
    });
});

// Apply the material settings to all shapes
const applyMaterials = () => {
    materials.forEach((material) => {
        material.diffuseMap = data.get('settings.texture') ? uvTexture : null;
        material.metalness = data.get('settings.metalness');
        material.gloss = data.get('settings.gloss');
        material.update();
    });
};
applyMaterials();

// Show the wireframes when the wireframe toggle is on
const applyWireframe = () => {
    wireframes.forEach((wireframe) => {
        wireframe.enabled = data.get('settings.wireframe');
    });
};
applyWireframe();

// Create an entity with a directional light component, casting soft shadows
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.95, 0.85),
    intensity: 1.5,
    castShadows: true,
    shadowBias: 0.1,
    normalOffsetBias: 0.1,
    shadowDistance: 15,
    shadowResolution: 2048,
    shadowType: SHADOW_PCSS_32F,
    penumbraSize: 0.05,
    penumbraFalloff: 4,
    shadowSamples: 16,
    shadowBlockerSamples: 16
});
app.root.addChild(light);
light.setLocalEulerAngles(40, -50, 0);

// Catch the shadows on the ground of the dome
const shadowCatcher = new Entity('shadow-catcher');
shadowCatcher.addComponent('script').create(ShadowCatcher, {
    properties: {
        scale: new Vec3(20, 20, 20)
    }
});
shadowCatcher.setLocalPosition(0, 0.01, 0);
app.root.addChild(shadowCatcher);

// Create an entity with a camera component, orbiting the shapes
const camera = new Entity();
camera.addComponent('camera', {
    fov: 45,
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
app.root.addChild(camera);
camera.setLocalPosition(0, 3, 7);

camera.script.create(CameraControls, {
    properties: {
        focusPoint: new Vec3(0, 0.5, 0),
        enableFly: false,
        pitchRange: new Vec2(-89, -5),
        zoomRange: new Vec2(2, 20)
    }
});

const settingsEvent = data.on('*:set', (/** @type {string} */ path) => {
    if (path.startsWith('settings.radius')) {
        updateRoundedBox();
    } else if (path === 'settings.wireframe') {
        applyWireframe();
    } else if (path.startsWith('settings.')) {
        applyMaterials();
    }
});

app.on('destroy', () => {
    settingsEvent.unbind();
    uvTexture.destroy();
});
