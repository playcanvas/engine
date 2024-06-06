import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    particlesNumbers: new pc.Asset('particlesNumbers', 'texture', {
        url: rootPath + '/static/assets/textures/particles-numbers.png'
    })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ParticleSystemComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [
    // @ts-ignore
    pc.TextureHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.75, 0.75, 0.75)
    });
    cameraEntity.rotateLocal(0, 0, 0);
    cameraEntity.translateLocal(0, 0, 20);

    // Create a directional light
    const lightDirEntity = new pc.Entity();
    lightDirEntity.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        intensity: 1
    });
    lightDirEntity.setLocalEulerAngles(45, 0, 0);

    // Create a screen to display the particle texture
    const screenEntity = new pc.Entity();
    screenEntity.addComponent('screen', { resolution: new pc.Vec2(640, 480), screenSpace: true });
    screenEntity.screen.scaleMode = 'blend';
    screenEntity.screen.referenceResolution = new pc.Vec2(1280, 720);

    // Create a panel to display the full particle texture
    const panel = new pc.Entity();
    screenEntity.addChild(panel);

    // Add Entities into the scene hierarchy
    app.root.addChild(cameraEntity);
    app.root.addChild(lightDirEntity);
    app.root.addChild(screenEntity);

    // Create entity for first particle system
    const particleEntity1 = new pc.Entity();
    app.root.addChild(particleEntity1);
    particleEntity1.setLocalPosition(-3, 3, 0);

    // Create entity for second particle system
    const particleEntity2 = new pc.Entity();
    app.root.addChild(particleEntity2);
    particleEntity2.setLocalPosition(3, 3, 0);

    // Create entity for third particle system
    const particleEntity3 = new pc.Entity();
    app.root.addChild(particleEntity3);
    particleEntity3.setLocalPosition(-3, -3, 0);

    // Create entity for fourth particle system
    const particleEntity4 = new pc.Entity();
    app.root.addChild(particleEntity4);
    particleEntity4.setLocalPosition(3, -3, 0);

    // when the texture is loaded add particlesystem components to particle entities

    // gradually make sparks bigger
    const scaleCurve = new pc.Curve([0, 0, 1, 1]);

    const particleSystemConfiguration = {
        numParticles: 8,
        lifetime: 4,
        rate: 0.5,
        colorMap: assets.particlesNumbers.resource,
        initialVelocity: 0.25,
        emitterShape: pc.EMITTERSHAPE_SPHERE,
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
        anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
        pivot: new pc.Vec2(0.5, 0.5),
        width: 100,
        height: 100,
        type: 'image',
        textureAsset: assets.particlesNumbers
    });

    app.start();
});

export { app };
