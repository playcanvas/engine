import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    apartment: new pc.Asset('apartment', 'container', { url: `${rootPath}/static/assets/models/apartment.glb` }),
    love: new pc.Asset('love', 'container', { url: `${rootPath}/static/assets/models/love.glb` }),
    colors: new pc.Asset('colors', 'texture', { url: `${rootPath}/static/assets/textures/colors.webp` }, { srgb: true }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    colorLut: new pc.Asset('colorLut', 'texture', { url: `${rootPath}/static/assets/cube-luts/lut-blue.png` })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`,

    // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
    // to avoid the additional cost. This is only used for the UI which renders on top of the
    // post-processed scene, and we're typically happy with some aliasing on the UI.
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.ScreenComponentSystem,
    pc.ButtonComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.FontHandler
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
    app.start();

    // setup skydome with low intensity
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.exposure = 1.2;

    // create an instance of the apartment and add it to the scene
    const platformEntity = assets.apartment.resource.instantiateRenderEntity();
    platformEntity.setLocalScale(30, 30, 30);
    app.root.addChild(platformEntity);

    // load a love sign model and add it to the scene
    const loveEntity = assets.love.resource.instantiateRenderEntity();
    loveEntity.setLocalPosition(-80, 30, -20);
    loveEntity.setLocalScale(130, 130, 130);
    loveEntity.rotate(0, -90, 0);
    app.root.addChild(loveEntity);

    // make the love sign emissive to bloom
    const loveMaterial = loveEntity.findByName('s.0009_Standard_FF00BB_0').render.meshInstances[0].material;
    loveMaterial.emissiveIntensity = 200;
    loveMaterial.update();

    // adjust all materials of the love sign to disable dynamic refraction
    loveEntity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((meshInstance) => {
            meshInstance.material.useDynamicRefraction = false;
        });
    });

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        farClip: 1500,
        fov: 80
    });

    const focusPoint = new pc.Entity();
    focusPoint.setLocalPosition(-80, 80, -20);

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: focusPoint,
            distanceMax: 500,
            frameOnStart: false
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    cameraEntity.setLocalPosition(-50, 100, 220);
    cameraEntity.lookAt(0, 0, 100);
    app.root.addChild(cameraEntity);

    // Create a 2D screen
    const screen = new pc.Entity();
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });
    app.root.addChild(screen);

    // Create a new entity for the UI element
    const uiElement = new pc.Entity();

    // Add a UI component with an image type
    const texture = assets.colors.resource;
    uiElement.addComponent('element', {
        type: 'image',
        anchor: [1, 0, 1, 0],
        pivot: [1, 0],
        width: texture.width * 0.5,
        height: texture.height * 0.5,
        texture: texture
    });
    uiElement.setLocalPosition(-0.1 * texture.width, 0.1 * texture.height, 0);
    screen.addChild(uiElement);

    // ------ Custom render passes set up ------

    const cameraFrame = new pc.CameraFrame(app, cameraEntity.camera);
    cameraFrame.rendering.samples = 4;
    cameraFrame.bloom.intensity = 0.03;
    cameraFrame.bloom.blurLevel = 7;
    cameraFrame.vignette.inner = 0.5;
    cameraFrame.vignette.outer = 1;
    cameraFrame.vignette.curvature = 0.5;
    cameraFrame.vignette.intensity = 0.5;

    // Apply Color LUT
    cameraFrame.colorLUT.texture = assets.colorLut.resource;
    cameraFrame.colorLUT.intensity = 1.0;

    cameraFrame.update();

    // apply UI changes
    data.on('*:set', (/** @type {string} */ path, value) => {

        if (path === 'data.hdr') {
            cameraFrame.enabled = value;
            cameraFrame.update();
        }

        if (path === 'data.sceneTonemapping') {
            // postprocessing tone mapping
            cameraFrame.rendering.toneMapping = value;
            cameraFrame.update();
        }

        if (path === 'data.colorLutIntensity') {
            cameraFrame.colorLUT.intensity = value;
            cameraFrame.update();
        }
    });

    // set initial values
    data.set('data', {
        hdr: true,
        sceneTonemapping: pc.TONEMAP_ACES,
        colorLutIntensity: 1.0
    });
});

export { app };
