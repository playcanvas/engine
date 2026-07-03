import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Curve,
    EMITTERSHAPE_SPHERE,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    ParticleSystemComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScreenComponentSystem,
    TextureHandler,
    Vec2,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    particlesNumbers: new Asset(
        'particlesNumbers',
        'texture',
        {
            url: './assets/textures/particles-numbers.png'
        },
        { srgb: true }
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
    ParticleSystemComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [
    // @ts-ignore
    TextureHandler
];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.75, 0.75, 0.75)
});
cameraEntity.rotateLocal(0, 0, 0);
cameraEntity.translateLocal(0, 0, 20);

// Create a directional light
const lightDirEntity = new Entity();
lightDirEntity.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    intensity: 1
});
lightDirEntity.setLocalEulerAngles(45, 0, 0);

// Create a screen to display the particle texture
const screenEntity = new Entity();
screenEntity.addComponent('screen', { resolution: new Vec2(640, 480), screenSpace: true });
screenEntity.screen.scaleMode = 'blend';
screenEntity.screen.referenceResolution = new Vec2(1280, 720);

// Create a panel to display the full particle texture
const panel = new Entity();
screenEntity.addChild(panel);

// Add Entities into the scene hierarchy
app.root.addChild(cameraEntity);
app.root.addChild(lightDirEntity);
app.root.addChild(screenEntity);

// Create entity for first particle system
const particleEntity1 = new Entity();
app.root.addChild(particleEntity1);
particleEntity1.setLocalPosition(-3, 3, 0);

// Create entity for second particle system
const particleEntity2 = new Entity();
app.root.addChild(particleEntity2);
particleEntity2.setLocalPosition(3, 3, 0);

// Create entity for third particle system
const particleEntity3 = new Entity();
app.root.addChild(particleEntity3);
particleEntity3.setLocalPosition(-3, -3, 0);

// Create entity for fourth particle system
const particleEntity4 = new Entity();
app.root.addChild(particleEntity4);
particleEntity4.setLocalPosition(3, -3, 0);

// when the texture is loaded add particlesystem components to particle entities

// gradually make sparks bigger
const scaleCurve = new Curve([0, 0, 1, 1]);

const particleSystemConfiguration = {
    numParticles: 8,
    lifetime: 4,
    rate: 0.5,
    colorMap: assets.particlesNumbers.resource,
    initialVelocity: 0.25,
    emitterShape: EMITTERSHAPE_SPHERE,
    emitterRadius: 0.1,
    animLoop: true,
    animTilesX: 4,
    animTilesY: 4,
    animSpeed: 1,
    autoPlay: true,
    scaleGraph: scaleCurve
};

let options;

options = Object.assign(particleSystemConfiguration, {
    // states that each animation in the sprite sheet has 4 frames
    animNumFrames: 4,
    // set the animation index of the first particle system to 0
    animIndex: 0
});
particleEntity1.addComponent('particlesystem', options);

options = Object.assign(particleSystemConfiguration, {
    // states that each animation in the sprite sheet has 4 frames
    animNumFrames: 4,
    // set the animation index of the second particle system to 1
    animIndex: 1
});
particleEntity2.addComponent('particlesystem', options);

options = Object.assign(particleSystemConfiguration, {
    // states that each animation in the sprite sheet has 4 frames
    animNumFrames: 4,
    // set the animation index of the third particle system to 2
    animIndex: 2
});
particleEntity3.addComponent('particlesystem', options);

options = Object.assign(particleSystemConfiguration, {
    // states that each animation in the sprite sheet has 4 frames
    animNumFrames: 4,
    // set the animation index of the fourth particle system to 3
    animIndex: 3
});
particleEntity4.addComponent('particlesystem', options);

// add the full particle texture to the panel
panel.addComponent('element', {
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    pivot: new Vec2(0.5, 0.5),
    width: 100,
    height: 100,
    type: 'image',
    textureAsset: assets.particlesNumbers
});

app.start();
