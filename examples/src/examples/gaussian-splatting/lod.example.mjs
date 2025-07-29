// @config HIDDEN
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);

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
createOptions.keyboard = new pc.Keyboard(document.body);

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

pc.Tracing.set(pc.TRACEID_SHADER_ALLOC, true);

const assets = {
    church: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/morocco.ply` }),
    logo: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/pclogo.ply` }),
    guitar: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/guitar.compressed.ply` }),
    skull: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/skull.ply` }),
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // create a splat entity and place it in the world
    const skull = new pc.Entity();
    skull.addComponent('gsplat', {
        asset: assets.skull,
        unified: true
    });
    skull.setLocalPosition(2.5, 1, 1);
    skull.setLocalEulerAngles(180, 90, 0);
    skull.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(skull);

    // create a splat entity and place it in the world
    const logo = new pc.Entity();
    logo.addComponent('gsplat', {
        asset: assets.logo,
        unified: true
    });
    app.root.addChild(logo);
    logo.setLocalPosition(0, 1.5, 1);
    logo.setLocalEulerAngles(180, 0, 0);
    logo.setLocalScale(0.5, 0.5, 0.5);

    // create a splat entity and place it in the world
    const church = new pc.Entity();
    church.addComponent('gsplat', {
        asset: assets.church,
        unified: true
    });
    app.root.addChild(church);
    church.setLocalEulerAngles(180, 90, 0);

    const guitar = new pc.Entity();
    guitar.addComponent('gsplat', {
        asset: assets.guitar,
        unified: true
    });
    app.root.addChild(guitar);
    guitar.setLocalPosition(0, 0.6, 4);
    guitar.setLocalEulerAngles(180, 0, 0);
    guitar.setLocalScale(0.5, 0.5, 0.5);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 75,
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(-0.8, 2, 3);
    camera.lookAt(2, 2, 0);
    app.root.addChild(camera);

    camera.addComponent('script');
    const cc = /** @type { CameraControls} */ (camera.script.create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: 0.005,
        moveFastSpeed: 0.03,
        enableOrbit: false,
        enablePan: false
    });


    let timeToChange = 1;
    let time = 0;
    let guitarTime = 0;
    let added = false;
    app.on('update', (/** @type {number} */ dt) => {
        time += dt;
        timeToChange -= dt;

        // ping pong logo between two positions along x-axies
        logo.setLocalPosition(5.5 + 5 * Math.sin(time), 1.5, -2);
        logo.rotateLocal(0, 100 * dt, 0);

        // update the guitar as well
        guitarTime += dt;
        guitar.setLocalPosition(0.5 * Math.sin(guitarTime), 2, 0.5 * Math.cos(guitarTime) + 1);

        if (timeToChange <= 0) {

            if (!added) {
                console.log('adding skull');
                added = true;
                timeToChange = 1;

                skull.enabled = true;

            } else {
                console.log('removing skull');
                added = false;
                timeToChange = 1;

                skull.enabled = false;
            }
        }
    });
});

export { app };
