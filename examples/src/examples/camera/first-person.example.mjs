// @config DESCRIPTION <div style='text-align:center'><div>(<b>WASD</b>) Move</div><div>(<b>Space</b>) Jump</div><div>(<b>Mouse</b>) Look</div></div>
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: rootPath + '/static/lib/ammo/ammo.wasm.js',
    wasmUrl: rootPath + '/static/lib/ammo/ammo.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/ammo/ammo.js'
});

await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve(true));
});

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const assets = {
    map: new pc.Asset('map', 'container', { url: rootPath + '/static/assets/models/fps-map.glb' }),
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/first-person-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/morning-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.gamepads = new pc.GamePads();
createOptions.keyboard = new pc.Keyboard(window);
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem
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

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

function createLevel() {
    const entity = new pc.Entity();

    // map
    const map = assets.map.resource.instantiateRenderEntity();
    map.setLocalScale(2, 2, 2);
    map.setLocalEulerAngles(-90, 0, 0);

    // add physics
    map.findComponents('render').forEach((/** @type {pc.RenderComponent} */ render) => {
        const entity = render.entity;
        entity.addComponent('rigidbody', {
            type: 'static'
        });
        entity.addComponent('collision', {
            type: 'mesh',
            renderAsset: render.asset
        });
    });
    entity.addChild(map);

    return entity;
}

function createCharacterController(camera) {

    const entity = new pc.Entity('cc');
    entity.addChild(camera);
    entity.addComponent('collision', {
        type: 'capsule',
        radius: 0.5,
        height: 2
    });
    entity.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 100,
        linearDamping: 0,
        angularDamping: 0,
        linearFactor: pc.Vec3.ONE,
        angularFactor: pc.Vec3.ZERO,
        friction: 0.5,
        restitution: 0
    });
    entity.addComponent('script');
    entity.script.create('characterController', {
        attributes: {
            camera: camera,
            jumpForce: 850
        }
    });
    entity.script.create('desktopInput');
    entity.script.create('mobileInput');
    entity.script.create('gamePadInput');

    return entity;
}

app.start();

// skybox
app.scene.skyboxMip = 0;
app.scene.exposure = 0.4;
app.scene.skyboxHighlightMultiplier = 50;   // extra brightness for the clipped sun in the skybox to make it bloom more
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 10, 0);

// Increase gravity for more natural jumping
app.systems.rigidbody?.gravity.set(0, -18, 0);

const cameraEntity = new pc.Entity();
cameraEntity.addComponent('camera', {
    clearColor: new pc.Color().fromString('#DEF5FF'),
    farClip: 100,
    fov: 90
});
cameraEntity.setLocalPosition(0, 0.5, 0);

// ------ Custom render passes set up ------

const currentOptions = new pc.CameraFrameOptions();
currentOptions.samples = 4;
currentOptions.sceneColorMap = false;
currentOptions.bloomEnabled = true;

// and set up these rendering passes to be used by the camera, instead of its default rendering
const renderPassCamera = new pc.RenderPassCameraFrame(app, cameraEntity.camera, currentOptions);
cameraEntity.camera.renderPasses = [renderPassCamera];

const composePass = renderPassCamera.composePass;
composePass.toneMapping = pc.TONEMAP_ACES2;
composePass.bloomIntensity = 0.01;

// ------------------------------------------

const level = createLevel();
app.root.addChild(level);

const characterController = createCharacterController(cameraEntity);
characterController.setPosition(5, 2, 10);
app.root.addChild(characterController);

export { app };
