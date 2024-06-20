import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js',

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
    biker: new pc.Asset('gsplat', 'gsplat', { url: rootPath + '/static/assets/splats/biker.ply' }),
    orbit: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2)
    });
    camera.setLocalPosition(2, 1, 1);

    const createSplatInstance = (resource, px, py, pz, scale, vertex, fragment) => {
        const splat = resource.instantiate({
            fragment: fragment,
            vertex: vertex
        });
        splat.setLocalPosition(px, py, pz);
        splat.setLocalScale(scale, scale, scale);
        app.root.addChild(splat);
        return splat;
    };

    const biker = createSplatInstance(assets.biker.resource, -1.5, 0.05, 0, 0.7);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: biker,
            distanceMax: 60,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);
});

export { app };
