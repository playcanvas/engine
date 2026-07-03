import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    CubemapHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    KEY_1,
    KEY_2,
    KEY_3,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

function createMaterial(colors) {
    const material = new StandardMaterial();
    for (const param in colors) {
        material[param] = colors[param];
    }
    material.update();
    return material;
}

const assets = {
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    heart: new Asset('heart', 'texture', { url: './assets/textures/heart.png' }),
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
createOptions.keyboard = new Keyboard(document.body);
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, CubemapHandler, ScriptHandler];

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

// enable cookies which are disabled by default for clustered lighting
app.scene.lighting.cookiesEnabled = true;

// ambient lighting
app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// create an entity with the statue
const entity = assets.statue.resource.instantiateRenderEntity();

app.root.addChild(entity);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});
camera.translate(0, 15, 35);
camera.rotate(-14, 0, 0);
app.root.addChild(camera);

camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        frameOnStart: false,
        distanceMax: 500
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');

// ground material
const material = new StandardMaterial();
material.diffuse = Color.GRAY;
material.ambient = Color.GRAY;
material.gloss = 0.5;
material.metalness = 0.5;
material.useMetalness = true;
material.update();

// Create an Entity for the ground
const ground = new Entity();
ground.addComponent('render', {
    type: 'box',
    material: material
});
ground.setLocalScale(70, 1, 70);
ground.setLocalPosition(0, -0.5, 0);
app.root.addChild(ground);

// setup light data
data.set('lights', {
    spot: {
        enabled: true,
        intensity: 0.8,
        cookieIntensity: 1,
        shadowIntensity: 1
    },
    omni: {
        enabled: true,
        intensity: 0.8,
        cookieIntensity: 1,
        shadowIntensity: 1
    },
    directional: {
        enabled: true,
        intensity: 0.8,
        shadowIntensity: 1
    }
});

/** @type {{[key: string]: Entity }} */
const lights = {};

// Create an spot light
lights.spot = new Entity();
lights.spot.addComponent('light', {
    ...{
        type: 'spot',
        color: Color.WHITE,
        innerConeAngle: 30,
        outerConeAngle: 31,
        range: 100,
        castShadows: true,
        shadowBias: 0.05,
        normalOffsetBias: 0.03,
        shadowResolution: 2048,
        // heart texture's alpha channel as a cookie texture
        cookie: assets.heart.resource,
        cookieChannel: 'a'
    },
    ...data.get('lights.spot')
});

const cone = new Entity();
cone.addComponent('render', {
    type: 'cone',
    castShadows: false,
    material: createMaterial({ emissive: Color.WHITE })
});
lights.spot.addChild(cone);
app.root.addChild(lights.spot);

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
    ]
});
cubemapAsset.loadFaces = true;
app.assets.add(cubemapAsset);

// Create a omni light
lights.omni = new Entity();
lights.omni.addComponent('light', {
    ...{
        type: 'omni',
        color: Color.YELLOW,
        castShadows: true,
        shadowBias: 0.05,
        normalOffsetBias: 0.03,
        shadowType: SHADOW_PCF3_32F,
        shadowResolution: 256,
        range: 111,
        cookieAsset: cubemapAsset,
        cookieChannel: 'rgb'
    },
    ...data.get('lights.omni')
});
lights.omni.addComponent('render', {
    type: 'sphere',
    castShadows: false,
    material: createMaterial({ diffuse: Color.BLACK, emissive: Color.YELLOW })
});
app.root.addChild(lights.omni);

// Create a directional light
lights.directional = new Entity();
lights.directional.addComponent('light', {
    ...{
        type: 'directional',
        color: Color.CYAN,
        range: 100,
        shadowDistance: 50,
        castShadows: true,
        shadowBias: 0.1,
        normalOffsetBias: 0.2
    },
    ...data.get('lights.directional')
});
app.root.addChild(lights.directional);

// Allow user to toggle individual lights
app.keyboard.on(
    'keydown',
    e => {
        // if the user is editing an input field, ignore key presses
        if (e.element.constructor.name === 'HTMLInputElement') return;
        switch (e.key) {
            case KEY_1:
                data.set('lights.omni.enabled', !data.get('lights.omni.enabled'));
                break;
            case KEY_2:
                data.set('lights.spot.enabled', !data.get('lights.spot.enabled'));
                break;
            case KEY_3:
                data.set('lights.directional.enabled', !data.get('lights.directional.enabled'));
                break;
        }
    },
    this
);

// Simple update loop to rotate the light
let angleRad = 1;
app.on('update', dt => {
    angleRad += 0.3 * dt;
    if (entity) {
        lights.spot.lookAt(new Vec3(0, -5, 0));
        lights.spot.rotateLocal(90, 0, 0);
        lights.spot.setLocalPosition(15 * Math.sin(angleRad), 25, 15 * Math.cos(angleRad));

        lights.omni.setLocalPosition(5 * Math.sin(-2 * angleRad), 10, 5 * Math.cos(-2 * angleRad));
        lights.omni.rotate(0, 50 * dt, 0);

        lights.directional.setLocalEulerAngles(45, -60 * angleRad, 0);
    }
});

data.on('*:set', (/** @type {string} */ path, value) => {
    const pathArray = path.split('.');
    if (pathArray[2] === 'enabled') {
        lights[pathArray[1]].enabled = value;
    } else {
        // @ts-ignore
        lights[pathArray[1]].light[pathArray[2]] = value;
    }
});
