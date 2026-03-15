import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    house: new pc.Asset('house', 'container', { url: `${rootPath}/static/assets/models/pbr-house.glb` }),
    cube: new pc.Asset('cube', 'container', { url: `${rootPath}/static/assets/models/playcanvas-cube.glb` }),
    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/table-mountain-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable anti-aliasing as TAA is used to smooth edges
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

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
    app.scene.envAtlas = assets.envatlas.resource;
    app.scene.skyboxMip = 0;
    app.scene.exposure = 2.5;

    // create an instance of the house and add it to the scene
    const houseEntity = assets.house.resource.instantiateRenderEntity();
    houseEntity.setLocalScale(100, 100, 100);
    app.root.addChild(houseEntity);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        nearClip: 10,
        farClip: 600,
        fov: 80
    });

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: houseEntity,
            distanceMax: 400,
            frameOnStart: true
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');
    cameraEntity.setLocalPosition(0, 40, -220);
    cameraEntity.lookAt(0, 0, 100);
    app.root.addChild(cameraEntity);

    // add a shadow casting directional light
    const lightColor = new pc.Color(1, 1, 1);
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: lightColor,
        intensity: 1,
        range: 700,
        shadowResolution: 4096,
        shadowDistance: 600,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(40, 10, 0);

    const cubeEntity = assets.cube.resource.instantiateRenderEntity();
    cubeEntity.setLocalScale(30, 30, 30);
    app.root.addChild(cubeEntity);

    // ------ Custom render passes set up ------

    const cameraFrame = new pc.CameraFrame(app, cameraEntity.camera);
    cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
    cameraFrame.bloom.intensity = 0.02;
    cameraFrame.update();

    // ------

    const applySettings = () => {

        cameraFrame.bloom.intensity = data.get('data.scene.bloom') ? 0.02 : 0;
        cameraFrame.taa.enabled = data.get('data.taa.enabled');
        cameraFrame.taa.jitter = data.get('data.taa.jitter');
        cameraFrame.rendering.renderTargetScale = data.get('data.scene.scale');
        cameraFrame.rendering.sharpness = data.get('data.scene.sharpness');
        cameraFrame.update();
    };

    // apply UI changes
    data.on('*:set', (/** @type {string} */ path, value) => {
        applySettings();

        // TAA has been flipped, setup sharpening appropriately
        const pathArray = path.split('.');
        if (pathArray[2] === 'enabled') {
            data.set('data.scene.sharpness', value ? 1 : 0);
        }
    });

    // set initial values
    data.set('data', {
        scene: {
            scale: 1,
            bloom: true,
            sharpness: 0.5
        },
        taa: {
            enabled: true,
            jitter: 1
        }
    });

    let time = 0;
    app.on('update', (/** @type {number} */ dt) => {
        time += dt;
        cubeEntity.setLocalPosition(130 * Math.sin(time), 0, 130 * Math.cos(time));
        cubeEntity.rotate(50 * dt, 20 * dt, 30 * dt);
    });
});

export { app };
