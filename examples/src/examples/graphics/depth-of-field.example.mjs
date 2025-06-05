// @config E2E_TEST
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    apartment: new pc.Asset('apartment', 'container', { url: `${rootPath}/static/assets/models/apartment.glb` }),
    love: new pc.Asset('love', 'container', { url: `${rootPath}/static/assets/models/love.glb` }),
    cat: new pc.Asset('cat', 'container', { url: `${rootPath}/static/assets/models/cat.glb` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
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
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler
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
    loveEntity.setLocalPosition(-335, 180, 0);
    loveEntity.setLocalScale(130, 130, 130);
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

    // add a cat model to the scene
    const cat = assets.cat.resource.instantiateRenderEntity();
    cat.setLocalPosition(-80, 80, -20);
    cat.setLocalScale(80, 80, 80);
    app.root.addChild(cat);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        farClip: 1500,
        fov: 80
    });

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: cat,
            distanceMax: 500,
            frameOnStart: false
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    cameraEntity.setLocalPosition(-50, 100, 220);
    cameraEntity.lookAt(0, 0, 100);
    app.root.addChild(cameraEntity);

    // ------ Custom render passes set up ------

    const cameraFrame = new pc.CameraFrame(app, cameraEntity.camera);
    cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
    cameraFrame.rendering.samples = 4;
    cameraFrame.bloom.intensity = 0.03;
    cameraFrame.bloom.blurLevel = 7;
    cameraFrame.vignette.inner = 0.5;
    cameraFrame.vignette.outer = 1;
    cameraFrame.vignette.curvature = 0.5;
    cameraFrame.vignette.intensity = 0.5;

    cameraFrame.update();

    const applySettings = () => {

        // TAA
        const taa = data.get('data.taa.enabled');
        cameraFrame.taa.enabled = taa;
        cameraFrame.taa.jitter = data.get('data.taa.jitter');
        cameraFrame.rendering.sharpness = taa ? 1 : 0;

        // DOF
        cameraFrame.dof.enabled = data.get('data.dof.enabled');
        cameraFrame.dof.nearBlur = data.get('data.dof.nearBlur');
        cameraFrame.dof.focusDistance = data.get('data.dof.focusDistance');
        cameraFrame.dof.focusRange = data.get('data.dof.focusRange');
        cameraFrame.dof.blurRadius = data.get('data.dof.blurRadius');
        cameraFrame.dof.blurRings = data.get('data.dof.blurRings');
        cameraFrame.dof.blurRingPoints = data.get('data.dof.blurRingPoints');
        cameraFrame.dof.highQuality = data.get('data.dof.highQuality');

        // display number of bluring samples are used
        const kernel = pc.Kernel.concentric(cameraFrame.dof.blurRings, cameraFrame.dof.blurRingPoints);
        data.set('data.stats.blurSamples', `${kernel.length >> 1}`);

        // debug
        switch (data.get('data.scene.debug')) {
            case 0: cameraFrame.debug = null; break;
            case 1: cameraFrame.debug = 'bloom'; break;
            case 2: cameraFrame.debug = 'vignette'; break;
            case 3: cameraFrame.debug = 'dofcoc'; break;
            case 4: cameraFrame.debug = 'dofblur'; break;
            case 5: cameraFrame.debug = 'scene'; break;
        }

        // apply all settings
        cameraFrame.update();
    };

    // apply UI changes
    data.on('*:set', (/** @type {string} */ path) => {
        const pathArray = path.split('.');
        if (pathArray[1] !== 'stats') {
            applySettings();
        }
    });

    // set initial values
    data.set('data', {
        scene: {
            debug: 0
        },
        taa: {
            enabled: false,
            jitter: 1
        },
        dof: {
            enabled: true,
            nearBlur: true,
            focusDistance: 200,
            focusRange: 100,
            blurRadius: 5,
            blurRings: 4,
            blurRingPoints: 5,
            highQuality: true
        }
    });
});

export { app };
