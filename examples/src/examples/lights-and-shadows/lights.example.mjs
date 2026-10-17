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
    WireRenderer,
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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Enable cookies which are disabled by default for clustered lighting
app.scene.lighting.cookiesEnabled = true;

// Ambient lighting
app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Create an entity with the statue
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

// Ground material
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

// Construct the cubemap asset for the omni light cookie texture
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

// Setup light data. The settings of a type apply to every light of that type; 'count' is how
// many there are, driven by the Add / Remove buttons.
data.set('lights', {
    spot: {
        enabled: true,
        intensity: 0.8,
        cookieIntensity: 1,
        shadowIntensity: 1,
        count: 0
    },
    omni: {
        enabled: true,
        intensity: 0.8,
        cookieIntensity: 1,
        shadowIntensity: 1,
        count: 0
    },
    directional: {
        enabled: true,
        intensity: 0.8,
        shadowIntensity: 1,
        count: 0
    }
});

// Setup material data. Note this is set up before the observer handler below is registered, so that
// it does not fire for the initial value.
data.set('material', {
    flatShading: false
});

// Debug rendering of the shape and extent of every light, in the light's own color
data.set('debug', {
    lightShapes: true
});
const wire = new WireRenderer(app);

// A palette per type, so that several lights of one type are told apart by their color as well as
// by where their light and shadows fall. The first light of each type keeps its traditional color.
const palettes = {
    spot: [Color.WHITE, new Color(1, 0.6, 0.3), new Color(0.5, 0.8, 1)],
    omni: [Color.YELLOW, new Color(0.4, 1, 0.5), new Color(1, 0.4, 0.5)],
    directional: [Color.CYAN, new Color(1, 0.5, 0.2), new Color(1, 0.3, 1)]
};

/** @type {{ spot: Entity[], omni: Entity[], directional: Entity[] }} */
const lights = {
    spot: [],
    omni: [],
    directional: []
};

/**
 * The light settings the user controls, from the data for a type - excluding 'count', which is
 * not a light property.
 *
 * @param {string} type - The light type.
 * @returns {object} The settings to apply to a light component.
 */
const lightSettings = (type) => {
    const { enabled, intensity, cookieIntensity, shadowIntensity } = data.get(`lights.${type}`);
    return type === 'directional'
        ? { enabled, intensity, shadowIntensity }
        : { enabled, intensity, cookieIntensity, shadowIntensity };
};

/**
 * Creates a light of the given type. Its index picks its color and, in the update loop, where it
 * sits or points, so that several lights of one type cast visibly separate light and shadows.
 *
 * @param {'spot'|'omni'|'directional'} type - The light type.
 * @param {number} index - The index of the light among its type.
 * @returns {Entity} The light entity.
 */
function createLight(type, index) {
    const palette = palettes[type];
    const color = palette[index % palette.length];
    const light = new Entity(`${type} ${index}`);

    switch (type) {
        case 'spot': {
            light.addComponent('light', {
                type: 'spot',
                color: color,
                innerConeAngle: 30,
                outerConeAngle: 31,
                range: 100,
                castShadows: true,
                shadowBias: 0.05,
                normalOffsetBias: 0.03,
                shadowResolution: 2048,
                // Heart texture's alpha channel as a cookie texture
                cookie: assets.heart.resource,
                cookieChannel: 'a',
                ...lightSettings(type)
            });
            const cone = new Entity();
            cone.addComponent('render', {
                type: 'cone',
                castShadows: false,
                material: createMaterial({ emissive: color })
            });
            light.addChild(cone);
            break;
        }

        case 'omni':
            light.addComponent('light', {
                type: 'omni',
                color: color,
                castShadows: true,
                shadowBias: 0.05,
                normalOffsetBias: 0.03,
                shadowType: SHADOW_PCF3_32F,
                shadowResolution: 256,
                range: 111,
                cookieAsset: cubemapAsset,
                cookieChannel: 'rgb',
                ...lightSettings(type)
            });
            light.addComponent('render', {
                type: 'sphere',
                castShadows: false,
                material: createMaterial({ diffuse: Color.BLACK, emissive: color })
            });
            break;

        case 'directional':
            light.addComponent('light', {
                type: 'directional',
                color: color,
                range: 100,
                shadowDistance: 300,
                numCascades: 2,
                shadowResolution: 2048,
                castShadows: true,
                shadowBias: 0.1,
                normalOffsetBias: 0.2,
                ...lightSettings(type)
            });
            // a directional light shines from everywhere, so its position only places the arrow
            // that visualizes its direction - above the statue, out of the way of the shadows
            light.setLocalPosition(0, 22, 0);
            break;
    }

    app.root.addChild(light);
    return light;
}

/**
 * @param {'spot'|'omni'|'directional'} type - The light type.
 */
function addLight(type) {
    const list = lights[type];
    list.push(createLight(type, list.length));
    data.set(`lights.${type}.count`, list.length);
}

/**
 * @param {'spot'|'omni'|'directional'} type - The light type.
 */
function removeLight(type) {
    const list = lights[type];
    const light = list.pop();
    if (light) {
        light.destroy();
        data.set(`lights.${type}.count`, list.length);
    }
}

// start with one light of each type
addLight('spot');
addLight('omni');
addLight('directional');

data.on('add', (type) => addLight(type));
data.on('remove', (type) => removeLight(type));

// Allow user to toggle the lights of a type
app.keyboard.on(
    'keydown',
    (e) => {
        // If the user is editing an input field, ignore key presses
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

// Simple update loop to move the lights. The lights of a type share a turn round the statue
// equally - and the directional lights differ in elevation too - so that however many there are,
// their light and shadows are told apart.
let angleRad = 1;
app.on('update', (dt) => {
    angleRad += 0.3 * dt;
    if (entity) {
        const turn = Math.PI * 2;

        lights.spot.forEach((spot, i) => {
            const angle = angleRad + (i / lights.spot.length) * turn;
            spot.lookAt(new Vec3(0, -5, 0));
            spot.rotateLocal(90, 0, 0);
            spot.setLocalPosition(15 * Math.sin(angle), 25, 15 * Math.cos(angle));
        });

        lights.omni.forEach((omni, i) => {
            const angle = -2 * angleRad + (i / lights.omni.length) * turn;
            omni.setLocalPosition(5 * Math.sin(angle), 10, 5 * Math.cos(angle));
            omni.rotate(0, 50 * dt, 0);
        });

        lights.directional.forEach((directional, i) => {
            const yaw = -60 * angleRad + (i / lights.directional.length) * 360;
            directional.setLocalEulerAngles(45 + ((i % 3) - 1) * 12, yaw, 0);
        });

        // Visualize the shape and extent of every enabled light, each drawn in the light's own
        // color. A light is disabled together with its entity, see the 'enabled' setting below.
        if (data.get('debug.lightShapes')) {
            /**
             * @param {Entity[]} entities - The light entities of one type.
             * @param {number} [size] - The arrow length, for directional lights that have no extent.
             */
            const drawShapes = (entities, size) => {
                entities.forEach((entity) => {
                    if (entity.enabled) wire.light(entity.light, size);
                });
            };
            drawShapes(lights.omni);
            drawShapes(lights.spot);
            drawShapes(lights.directional, 8);
        }
    }
});

data.on('*:set', (/** @type {string} */ path, value) => {
    const pathArray = path.split('.');

    if (pathArray[0] === 'material' && pathArray[1] === 'flatShading') {
        // Shade each triangle using its geometric normal instead of the normal interpolated from the
        // vertex normals, giving the statue and the ground a faceted look. Note how this also affects
        // the normal offset shadow bias, and so the shadows remain correct.
        app.root.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((meshInstance) => {
                meshInstance.material.flatShading = value;
                meshInstance.material.update();
            });
        });
        return;
    }

    if (pathArray[0] !== 'lights' || pathArray[2] === 'count') {
        return;
    }

    // a setting of a type applies to every light of that type
    const property = pathArray[2];
    lights[pathArray[1]].forEach((light) => {
        if (property === 'enabled') {
            light.enabled = value;
        } else {
            // @ts-ignore
            light.light[property] = value;
        }
    });
});
