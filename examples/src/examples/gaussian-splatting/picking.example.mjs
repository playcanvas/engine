// @config DESCRIPTION This example shows how to use the Picker to pick GSplat objects in the scene.
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`,

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
    skull: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/playcanvas-logo/meta.json` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/morning-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.skyboxMip = 3;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxIntensity = 0.3;

    // create multiple instances of the gsplat
    const entities = [];
    for (let i = 0; i < 7; i++) {

        // create a splat entity and place it in the world
        const splat = new pc.Entity(`splat-${i}`);
        splat.addComponent('gsplat', {
            asset: assets.skull,
            castShadows: false
        });

        app.root.addChild(splat);

        // specify custom vertex shader
        splat.gsplat.material.getShaderChunks('glsl').set('gsplatVS', files['shader.vert']);

        // set alpha clip value, used picking
        splat.gsplat.material.setParameter('alphaClip', 0.4);

        entities.push({
            entity: splat,
            fade: 0
        });
    }

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(-2, -0.5, 2);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMin: 14,
            distanceMax: 50
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);
    camera.setLocalPosition(200, 0, 0);

    // Custom render passes set up with bloom
    const cameraFrame = new pc.CameraFrame(app, camera.camera);
    cameraFrame.rendering.toneMapping = pc.TONEMAP_NEUTRAL;
    cameraFrame.rendering.samples = 1;
    cameraFrame.bloom.enabled = true;
    cameraFrame.bloom.intensity = 0.01;
    cameraFrame.update();

    // Create an instance of the picker class
    const picker = new pc.Picker(app, 1, 1);

    // update things each frame
    let time = 0;
    app.on('update', (dt) => {
        time += dt * 0.3;

        // rotate splats around their center and also orbit them around
        for (let e = 0; e < entities.length; e++) {
            const entity = entities[e];
            const fraction = e / entities.length;
            const offset2pi = time + fraction * 2 * Math.PI;
            entity.entity.setLocalPosition(6 * Math.sin(offset2pi), 0, 6 * Math.cos(offset2pi));
            entity.entity.rotate(0, 150 * fraction * dt, 0);

            // update face value and supply it to material as uniform
            entity.fade = Math.max(entity.fade - 0.5 * dt, 0);
            entity.entity.gsplat.material.setParameter('fade', entity.fade);
        }
    });

    // function handling mouse click / touch
    const handlePointer = (x, y) => {

        // Lets use quarter of the resolution to improve performance - this will miss very small objects, but it's ok in our case
        const pickerScale = 0.25;
        picker.resize(canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);

        // render the ID texture
        const worldLayer = app.scene.layers.getLayerByName('World');
        picker.prepare(camera.camera, app.scene, [worldLayer]);

        // get the meshInstance of the picked object
        picker.getSelectionAsync(x * pickerScale, y * pickerScale, 1, 1).then((meshInstances) => {

            if (meshInstances.length > 0) {
                const meshInstance = meshInstances[0];
                // find entity with matching mesh instance
                const entity = entities.find(e => e.entity.gsplat.instance.meshInstance === meshInstance);
                if (entity) {
                    // trigger the visual effect
                    entity.fade = 1;
                }
            }
        });
    };

    app.mouse.on(pc.EVENT_MOUSEDOWN, (event) => {
        handlePointer(event.x, event.y);
    });

    app.touch.on(pc.EVENT_TOUCHSTART, (event) => {
        const touch = event.touches[0];
        handlePointer(touch.x, touch.y);
    });
});

export { app };
