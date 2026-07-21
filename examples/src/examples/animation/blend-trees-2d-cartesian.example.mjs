import {
    ANIM_BLEND_2D_CARTESIAN,
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
    eagerAnim: new Asset('idleAnim', 'container', {
        url: './assets/animations/bitmoji/idle-eager.glb'
    }),
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

// Setup skydome
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

// Create an entity from the loaded model using the render component
const modelEntity = assets.model.resource.instantiateRenderEntity({
    castShadows: true
});
modelEntity.name = 'model';

// Add an anim component to the entity
modelEntity.addComponent('anim', {
    activate: true
});

// Create an anim state graph
const animStateGraphData = {
    layers: [
        {
            name: 'base',
            states: [
                {
                    name: 'START'
                },
                {
                    name: 'Emote',
                    speed: 1.0,
                    loop: true,
                    blendTree: {
                        type: ANIM_BLEND_2D_CARTESIAN,
                        parameters: ['posX', 'posY'],
                        children: [
                            {
                                name: 'Idle',
                                point: [-0.5, 0.5]
                            },
                            {
                                name: 'Eager',
                                point: [0.5, 0.5]
                            },
                            {
                                name: 'Walk',
                                point: [0.5, -0.5]
                            },
                            {
                                name: 'Dance',
                                point: [-0.5, -0.5]
                            }
                        ]
                    }
                }
            ],
            transitions: [
                {
                    from: 'START',
                    to: 'Emote'
                }
            ]
        }
    ],
    parameters: {
        posX: {
            name: 'posX',
            type: 'FLOAT',
            value: -0.5
        },
        posY: {
            name: 'posY',
            type: 'FLOAT',
            value: 0.5
        }
    }
};

// Load the state graph into the anim component
modelEntity.anim.loadStateGraph(animStateGraphData);

// Load the state graph asset resource into the anim component
const characterStateLayer = modelEntity.anim.baseLayer;
characterStateLayer.assignAnimation('Emote.Idle', assets.idleAnim.resource.animations[0].resource);
characterStateLayer.assignAnimation('Emote.Eager', assets.eagerAnim.resource.animations[0].resource);
characterStateLayer.assignAnimation('Emote.Dance', assets.danceAnim.resource.animations[0].resource);
characterStateLayer.assignAnimation('Emote.Walk', assets.walkAnim.resource.animations[0].resource);

// Initialize observer data
data.set('data', {
    pos: { x: -0.5, y: 0.5 },
    animPoints: []
});

// Helper to update animation points for visualization
const updateAnimPoints = () => {
    const points = characterStateLayer._controller._states.Emote.animations.map((/** @type {any} */ animNode) => ({
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
