// @config DESCRIPTION Renders Gaussian Splats from multiple camera viewports simultaneously with different projection types.
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
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
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

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

const assets = {
    logo: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/playcanvas-logo/meta.json` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // create a splat entity and place it in the world
    const logoEntity1 = new pc.Entity();
    logoEntity1.addComponent('gsplat', {
        asset: assets.logo,
        unified: true
    });
    logoEntity1.setLocalPosition(0, 0.05, 0);
    logoEntity1.setLocalEulerAngles(180, 90, 0);
    logoEntity1.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(logoEntity1);

    // create another splat entity and place it in the world
    const logoEntity2 = new pc.Entity();
    logoEntity2.addComponent('gsplat', {
        asset: assets.logo,
        unified: true
    });
    logoEntity2.setLocalPosition(0, -0.5, 0);
    logoEntity2.setLocalEulerAngles(-90, -90, 0);
    logoEntity2.setLocalScale(2, 2, 2);
    app.root.addChild(logoEntity2);

    // Create left camera
    const cameraLeft = new pc.Entity('LeftCamera');
    cameraLeft.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        farClip: 500,
        rect: new pc.Vec4(0, 0, 0.5, 0.5),
        toneMapping: pc.TONEMAP_ACES
    });
    cameraLeft.setLocalPosition(-0.8, 2, 3);
    app.root.addChild(cameraLeft);

    // Create right orthographic camera
    const cameraRight = new pc.Entity('RightCamera');
    cameraRight.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        farClip: 500,
        rect: new pc.Vec4(0.5, 0, 0.5, 0.5),
        projection: pc.PROJECTION_ORTHOGRAPHIC,
        orthoHeight: 4,
        toneMapping: pc.TONEMAP_ACES
    });
    cameraRight.translate(0, 8, 0);
    cameraRight.lookAt(pc.Vec3.ZERO, pc.Vec3.RIGHT);
    app.root.addChild(cameraRight);

    // Create top camera
    const cameraTop = new pc.Entity('TopCamera');
    cameraTop.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        farClip: 500,
        rect: new pc.Vec4(0, 0.5, 1, 0.5),
        toneMapping: pc.TONEMAP_ACES
    });
    cameraTop.translate(-2, 6, 9);
    app.root.addChild(cameraTop);

    // add orbit camera script with a mouse and a touch support to top camera
    cameraTop.addComponent('script');
    if (cameraTop.script) {
        cameraTop.script.create('orbitCamera', {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: logoEntity2,
                distanceMax: 60,
                frameOnStart: false
            }
        });
        cameraTop.script.create('orbitCameraInputMouse');
        cameraTop.script.create('orbitCameraInputTouch');
    }

    // update function called once per frame
    let time = 0;
    app.on('update', (dt) => {
        time += dt;

        // orbit left camera around the splat
        cameraLeft.setLocalPosition(6 * Math.sin(time * 0.2), 2, 6 * Math.cos(time * 0.2));
        cameraLeft.lookAt(logoEntity2.getPosition());

        // rotate camera right around splat differently
        cameraRight.setLocalPosition(6 * Math.sin(-time * 0.4), 2, 6 * Math.cos(-time * 0.4));
        cameraRight.lookAt(logoEntity2.getPosition());
    });
});

export { app };
