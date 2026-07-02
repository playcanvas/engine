import {
    ANIM_BLEND_2D_DIRECTIONAL,
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
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF5_32F,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    model: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    idleAnim: new Asset('idleAnim', 'container', { url: './assets/animations/bitmoji/idle.glb' }),
    walkAnim: new Asset('idleAnim', 'container', { url: './assets/animations/bitmoji/walk.glb' }),
    jogAnim: new Asset('idleAnim', 'container', { url: './assets/animations/bitmoji/run.glb' }),
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
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.elementInput = new ElementInput(canvas);

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

await new Promise((resolve) => {
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
modelEntity.name = 'model';

// add an anim component to the entity
modelEntity.addComponent('anim', {
    activate: true
});

// create an anim state graph
const animStateGraphData = {
    layers: [
        {
            name: 'locomotion',
            states: [
                {
                    name: 'START'
                },
                {
                    name: 'Travel',
                    speed: 1.0,
                    loop: true,
                    blendTree: {
                        type: ANIM_BLEND_2D_DIRECTIONAL,
                        syncDurations: true,
                        parameters: ['posX', 'posY'],
                        children: [
                            {
                                name: 'Idle',
                                point: [0.0, 0.0]
                            },
                            {
                                speed: -1,
                                name: 'WalkBackwards',
                                point: [0.0, -0.5]
                            },
                            {
                                speed: 1,
                                name: 'Walk',
                                point: [0.0, 0.5]
                            },
                            {
                                speed: 1,
                                name: 'Jog',
                                point: [0.0, 1.0]
                            }
                        ]
                    }
                }
            ],
            transitions: [
                {
                    from: 'START',
                    to: 'Travel'
                }
            ]
        }
    ],
    parameters: {
        posX: {
            name: 'posX',
            type: 'FLOAT',
            value: 0
        },
        posY: {
            name: 'posY',
            type: 'FLOAT',
            value: 0
        }
    }
};

// load the state graph into the anim component
modelEntity.anim.loadStateGraph(animStateGraphData);

// load the state graph asset resource into the anim component
const locomotionLayer = modelEntity.anim.baseLayer;
locomotionLayer.assignAnimation('Travel.Idle', assets.idleAnim.resource.animations[0].resource);
locomotionLayer.assignAnimation('Travel.Walk', assets.walkAnim.resource.animations[0].resource);
locomotionLayer.assignAnimation('Travel.WalkBackwards', assets.walkAnim.resource.animations[0].resource);
locomotionLayer.assignAnimation('Travel.Jog', assets.jogAnim.resource.animations[0].resource);

// Initialize observer data
data.set('data', {
    pos: { x: 0, y: 0 },
    animPoints: []
});

// Helper to update animation points for visualization
const updateAnimPoints = () => {
    const points = locomotionLayer._controller._states.Travel.animations.map((animNode) => ({
        x: animNode.point?.x ?? 0,
        y: animNode.point?.y ?? 0,
        weight: animNode.weight ?? 0
    }));
    data.set('data.animPoints', points);
};

// Set initial animation points
updateAnimPoints();

// Listen for position changes from controls
data.on('data.pos:set', (value) => {
    modelEntity.anim.setFloat('posX', value.x);
    modelEntity.anim.setFloat('posY', value.y);
    // Update animation points when position changes (weights recalculate)
    updateAnimPoints();
});

app.root.addChild(modelEntity);
app.start();
