import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    CubemapHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' }),
    xmas_negx: new Asset('xmas_negx', 'texture', {
        url: './assets/cubemaps/xmas_faces/xmas_negx.png'
    }),
    xmas_negy: new Asset('xmas_negy', 'texture', {
        url: './assets/cubemaps/xmas_faces/xmas_negy.png'
    }),
    xmas_negz: new Asset('xmas_negz', 'texture', {
        url: './assets/cubemaps/xmas_faces/xmas_negz.png'
    }),
    xmas_posx: new Asset('xmas_posx', 'texture', {
        url: './assets/cubemaps/xmas_faces/xmas_posx.png'
    }),
    xmas_posy: new Asset('xmas_posy', 'texture', {
        url: './assets/cubemaps/xmas_faces/xmas_posy.png'
    }),
    xmas_posz: new Asset('xmas_posz', 'texture', {
        url: './assets/cubemaps/xmas_faces/xmas_posz.png'
    })
};

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
createOptions.resourceHandlers = [ScriptHandler, TextureHandler, CubemapHandler];

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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('settings', {
    shadowAtlasResolution: 1300, // shadow map resolution storing all shadows
    shadowType: SHADOW_PCF3_32F, // shadow filter type
    shadowsEnabled: true,
    cookiesEnabled: true
});

// Enable clustered lighting. This is a temporary API and will change in the future
app.scene.clusteredLightingEnabled = true;

// Adjust default clustered lighting parameters to handle many lights
const lighting = app.scene.lighting;

// 1) Subdivide space with lights into this many cells
lighting.cells = new Vec3(16, 12, 16);

// 2) And allow this many lights per cell
lighting.maxLightsPerCell = 12;

// Enable clustered shadows (it's enabled by default as well)
lighting.shadowsEnabled = true;

// Enable clustered cookies
lighting.cookiesEnabled = true;

// Resolution of the shadow and cookie atlas
lighting.shadowAtlasResolution = data.get('settings.shadowAtlasResolution');
lighting.cookieAtlasResolution = 2048;

/**
 * helper function to create a 3d primitive including its material
 * @param {string} primitiveType - The primitive type.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @returns {Entity} The returned entity.
 */
function createPrimitive(primitiveType, position, scale) {
    // Create a material
    const material = new StandardMaterial();
    material.diffuse = new Color(0.7, 0.7, 0.7);

    // Normal map
    material.normalMap = assets.normal.resource;
    material.normalMapTiling.set(5, 5);
    material.bumpiness = 0.7;

    // Enable specular
    material.gloss = 0.4;
    material.metalness = 0.3;
    material.useMetalness = true;

    material.update();

    // Create the primitive using the material
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        material: material
    });

    // set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);

    return primitive;
}

// create the ground plane from the boxes
createPrimitive('box', new Vec3(0, 0, 0), new Vec3(800, 2, 800));
createPrimitive('box', new Vec3(0, 400, 0), new Vec3(800, 2, 800));

// walls
createPrimitive('box', new Vec3(400, 200, 0), new Vec3(2, 400, 800));
createPrimitive('box', new Vec3(-400, 200, 0), new Vec3(2, 400, 800));
createPrimitive('box', new Vec3(0, 200, 400), new Vec3(800, 400, 0));
createPrimitive('box', new Vec3(0, 200, -400), new Vec3(800, 400, 0));

const numTowers = 7;
for (let i = 0; i < numTowers; i++) {
    let scale = 25;
    const fraction = (i / numTowers) * Math.PI * 2;
    const radius = i % 2 ? 340 : 210;
    for (let y = 0; y <= 7; y++) {
        const prim = createPrimitive(
            'box',
            new Vec3(radius * Math.sin(fraction), 2 + y * 25, radius * Math.cos(fraction)),
            new Vec3(scale, scale, scale)
        );
        prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
    }
    scale -= 1.5;
}

// construct the cubemap asset for the omni light cookie texture
// Note: the textures array could contain 6 texture asset names to load instead as well
const cubemapAsset = new Asset('xmas_cubemap', 'cubemap', null, {
    textures: [
        assets.xmas_posx.id,
        assets.xmas_negx.id,
        assets.xmas_posy.id,
        assets.xmas_negy.id,
        assets.xmas_posz.id,
        assets.xmas_negz.id
    ],

    // don't generate mipmaps for the cookie cubemap if clustered lighting is used,
    // as only top levels are copied to the cookie atlas.
    mipmaps: !app.scene.clusteredLightingEnabled
});
cubemapAsset.loadFaces = true;
app.assets.add(cubemapAsset);

/** @type {Array<Entity>} */
const omniLights = [];
const numLights = 10;
for (let i = 0; i < numLights; i++) {
    const lightOmni = new Entity('Omni');
    lightOmni.addComponent('light', {
        type: 'omni',
        color: Color.WHITE,
        intensity: 10 / numLights,
        range: 350,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.2,

        // cookie texture
        cookieAsset: cubemapAsset,
        cookieChannel: 'rgb'
    });

    // attach a render component with a small sphere to it
    const material = new StandardMaterial();
    material.emissive = Color.WHITE;
    material.update();

    lightOmni.addComponent('render', {
        type: 'sphere',
        material: material,
        castShadows: false
    });
    lightOmni.setPosition(0, 120, 0);
    lightOmni.setLocalScale(5, 5, 5);
    app.root.addChild(lightOmni);

    omniLights.push(lightOmni);
}

// create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    fov: 80,
    clearColor: new Color(0.1, 0.1, 0.1),
    farClip: 1500,
    toneMapping: TONEMAP_ACES
});

// and position it in the world
camera.setLocalPosition(300, 120, 25);

// add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: app.root,
        distanceMax: 1200,
        frameOnStart: false
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// handle HUD changes - update properties on the scene
data.on('*:set', (/** @type {string} */ path, value) => {
    const pathArray = path.split('.');
    // @ts-ignore
    lighting[pathArray[1]] = value;
});

// Set an update function on the app's update event
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt * 0.3;
    const radius = 250;
    for (let i = 0; i < omniLights.length; i++) {
        const fraction = (i / omniLights.length) * Math.PI * 2;
        omniLights[i].setPosition(
            radius * Math.sin(time + fraction),
            190 + Math.sin(time + fraction) * 150,
            radius * Math.cos(time + fraction)
        );
    }

    // display shadow texture (debug feature)
    if (app.graphicsDevice.isWebGPU) {
        const texture = app.renderer.lightTextureAtlas.shadowAtlas?.texture;
        // skip if texture is not ready (placeholder or destroyed)
        if (texture?.device && texture.width > 1) {
            // @ts-ignore engine-tsd
            app.drawTexture(-0.7, -0.7, 0.5, 0.5, texture, undefined, undefined, false);
        }
    }
});
