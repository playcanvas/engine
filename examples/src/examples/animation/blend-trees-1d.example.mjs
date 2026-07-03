import {
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF5_32F,
    TEXTURETYPE_RGBP,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    model: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    idleAnim: new Asset('idleAnim', 'container', { url: './assets/animations/bitmoji/idle.glb' }),
    danceAnim: new Asset('danceAnim', 'container', {
        url: './assets/animations/bitmoji/win-dance.glb'
    }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

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
    AnimComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, AnimClipHandler, AnimStateGraphHandler];

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

// setup skydome
app.scene.exposure = 2;
app.scene.skyboxMip = 2;
app.scene.envAtlas = assets.helipad.resource;

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
cameraEntity.translate(0, 0.75, 3);
app.root.addChild(cameraEntity);

// Create an entity with a light component
const lightEntity = new Entity();
lightEntity.addComponent('light', {
    castShadows: true,
    intensity: 1.5,
    normalOffsetBias: 0.02,
    shadowType: SHADOW_PCF5_32F,
    shadowDistance: 6,
    shadowResolution: 2048,
    shadowBias: 0.02
});
app.root.addChild(lightEntity);
lightEntity.setLocalEulerAngles(45, 30, 0);

// create an entity from the loaded model using the render component
const modelEntity = assets.model.resource.instantiateRenderEntity({
    castShadows: true
});

// add an anim component to the entity
modelEntity.addComponent('anim', {
    activate: true
});

// create an anim state graph
const animStateGraphData = {
    layers: [
        {
            name: 'characterState',
            states: [
                {
                    name: 'START'
                },
                {
                    name: 'Movement',
                    speed: 1.0,
                    loop: true,
                    blendTree: {
                        type: '1D',
                        parameter: 'blend',
                        children: [
                            {
                                name: 'Idle',
                                point: 0.0
                            },
                            {
                                name: 'Dance',
                                point: 1.0,
                                speed: 0.85
                            }
                        ]
                    }
                }
            ],
            transitions: [
                {
                    from: 'START',
                    to: 'Movement'
                }
            ]
        }
    ],
    parameters: {
        blend: {
            name: 'blend',
            type: 'FLOAT',
            value: 0
        }
    }
};

// load the state graph into the anim component
modelEntity.anim.loadStateGraph(animStateGraphData);

// load the state graph asset resource into the anim component
const characterStateLayer = modelEntity.anim.baseLayer;
characterStateLayer.assignAnimation('Movement.Idle', assets.idleAnim.resource.animations[0].resource);
characterStateLayer.assignAnimation('Movement.Dance', assets.danceAnim.resource.animations[0].resource);

app.root.addChild(modelEntity);

data.on('blend:set', (/** @type {number} */ blend) => {
    modelEntity.anim.setFloat('blend', blend);
});

app.start();
