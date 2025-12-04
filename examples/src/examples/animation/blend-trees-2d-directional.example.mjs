import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    model: new pc.Asset('model', 'container', { url: `${rootPath}/static/assets/models/bitmoji.glb` }),
    idleAnim: new pc.Asset('idleAnim', 'container', { url: `${rootPath}/static/assets/animations/bitmoji/idle.glb` }),
    walkAnim: new pc.Asset('idleAnim', 'container', { url: `${rootPath}/static/assets/animations/bitmoji/walk.glb` }),
    jogAnim: new pc.Asset('idleAnim', 'container', { url: `${rootPath}/static/assets/animations/bitmoji/run.glb` }),
    danceAnim: new pc.Asset('danceAnim', 'container', {
        url: `${rootPath}/static/assets/animations/bitmoji/win-dance.glb`
    }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.AnimComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // setup skydome
    app.scene.exposure = 2;
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    cameraEntity.translate(0, 0.75, 3);
    app.root.addChild(cameraEntity);

    // Create an entity with a light component
    const lightEntity = new pc.Entity();
    lightEntity.addComponent('light', {
        castShadows: true,
        intensity: 1.5,
        normalOffsetBias: 0.02,
        shadowType: pc.SHADOW_PCF5_32F,
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
                            type: pc.ANIM_BLEND_2D_DIRECTIONAL,
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
        const points = locomotionLayer._controller._states.Travel.animations.map(animNode => ({
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
});

export { app };
