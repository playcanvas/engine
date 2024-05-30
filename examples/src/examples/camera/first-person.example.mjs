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
    ssao: new pc.Asset('ssao', 'script', { url: rootPath + '/static/scripts/posteffects/posteffect-ssao.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
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

    // lighting
    const light = new pc.Entity();
    light.addComponent('light', {
        castShadows: true,
        color: new pc.Color(1, 1, 1),
        normalOffsetBias: 0.05,
        shadowBias: 0.2,
        shadowDistance: 40,
        type: 'directional',
        shadowResolution: 2048
    });
    light.setLocalEulerAngles(45, 30, 0);
    entity.addChild(light);

    // map
    const map = assets.map.resource.instantiateRenderEntity();
    map.setLocalScale(3, 3, 3);
    map.setLocalEulerAngles(-90, 0, 0);

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

function createCharacterController() {
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color().fromString('#DEF5FF'),
        farClip: 100,
        fov: 90
    });
    camera.addComponent('script');
    camera.script.create('ssao', {
        attributes: {
            brightness: 0.4,
            radius: 0.5
        }
    });
    camera.setLocalPosition(0, 0.5, 0);

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

app.scene.ambientLight.set(0.2, 0.2, 0.2);

app.scene.skyboxMip = 1;
app.scene.envAtlas = assets.helipad.resource;

// Increase gravity for more natural jumping
app.systems.rigidbody?.gravity.set(0, -18, 0);

const level = createLevel();
app.root.addChild(level);

const characterController = createCharacterController();
characterController.setPosition(-4, 2, 10);
app.root.addChild(characterController);

export { app };
