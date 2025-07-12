// @config HIDDEN
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
    biker: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
    church: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/church.ply` }),
    logo: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/playcanvas-logo/meta.json` }),
    guitar: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/guitar.compressed.ply` }),
    fly: new pc.Asset('fly', 'script', { url: `${rootPath}/static/scripts/camera/fly-camera.js` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // create a splat entity and place it in the world
    const biker = new pc.Entity();
    biker.setLocalPosition(-1.5, 0.05, 0);
    biker.setLocalEulerAngles(180, 90, 0);
    biker.setLocalScale(0.7, 0.7, 0.7);

    const biker2 = new pc.Entity();
    biker2.setLocalPosition(-1.5, 0.6, 1);
    biker2.setLocalEulerAngles(180, 0, 0);
    biker2.setLocalScale(0.7, 0.7, 0.7);


    const logo = new pc.Entity();
    logo.setLocalPosition(0, 1.5, 1);
    logo.setLocalEulerAngles(180, 0, 0);
    logo.setLocalScale(0.5, 0.5, 0.5);

    const church = new pc.Entity();
    church.setLocalEulerAngles(180, 90, 0);

    const guitar = new pc.Entity();
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
    camera.addComponent('script');
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    camera.script.create('flyCamera', {
        attributes: {
            speed: 2
        }
    });

    app.root.addChild(camera);

    // temporary API
    const manager = new pc.GSplatManager(app.graphicsDevice,
        [assets.church.resource, assets.biker.resource, assets.biker.resource, assets.logo.resource, assets.guitar.resource],
        [church, biker, biker2, logo, guitar]
    );

    const worldLayer = app.scene.layers.getLayerByName('World');
    worldLayer.addMeshInstances([manager.meshInstance]);

    let time = 0;
    let guitarTime = 0;
    app.on('update', (/** @type {number} */ dt) => {
        time += dt;

        logo.rotateLocal(0, 100 * dt, 0);

        // each even second, update the guitar as well
        if (Math.floor(time) % 2 === 0) {
            guitarTime += dt;

            // orbit guitar around
            guitar.setLocalPosition(2.5 * Math.sin(guitarTime), 2, 2.5 * Math.cos(guitarTime) + 1);
        }

        manager.update(camera);
    });
});

export { app };
