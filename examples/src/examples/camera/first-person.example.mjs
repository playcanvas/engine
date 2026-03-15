// @config DESCRIPTION <div style='text-align:center'><div>(<b>WASD</b>) Move</div><div>(<b>Space</b>) Jump</div><div>(<b>Mouse</b>) Look</div></div>
import { deviceType, fileImport, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const { FirstPersonController } = await fileImport(`${rootPath}/static/scripts/esm/first-person-controller.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: `${rootPath}/static/lib/ammo/ammo.wasm.js`,
    wasmUrl: `${rootPath}/static/lib/ammo/ammo.wasm.wasm`,
    fallbackUrl: `${rootPath}/static/lib/ammo/ammo.js`
});

await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve(true));
});

const gfxOptions = {
    deviceTypes: [deviceType]
};

const assets = {
    map: new pc.Asset('map', 'container', { url: `${rootPath}/static/assets/models/fps-map.glb` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/morning-env-atlas.png` },
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

app.start();

// Skybox
app.scene.skyboxMip = 0;
app.scene.exposure = 0.4;
app.scene.skyboxHighlightMultiplier = 50;   // extra brightness for the clipped sun in the skybox to make it bloom more
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 10, 0);

// Gravity (increase for more realistic jumping)
app.systems.rigidbody?.gravity.set(0, -18, 0);

// Camera
const camera = new pc.Entity();
camera.addComponent('camera', {
    farClip: 100,
    fov: 90
});
camera.setLocalPosition(0, 0.5, 0);

// Custom render passes
const cameraFrame = new pc.CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES2;
cameraFrame.bloom.enabled = true;
cameraFrame.bloom.intensity = 0.01;
cameraFrame.update();

// Level
const map = assets.map.resource.instantiateRenderEntity();
map.setLocalScale(2, 2, 2);
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
const level = new pc.Entity();
level.addChild(map);
app.root.addChild(level);

// Character controller
const characterController = new pc.Entity('cc');
characterController.setPosition(5, 2, 10);
characterController.addChild(camera);
characterController.addComponent('collision', {
    type: 'capsule',
    radius: 0.5,
    height: 2
});
characterController.addComponent('rigidbody', {
    type: 'dynamic',
    mass: 100,
    linearDamping: 0,
    angularDamping: 0,
    linearFactor: pc.Vec3.ONE,
    angularFactor: pc.Vec3.ZERO,
    friction: 0.5,
    restitution: 0
});
characterController.addComponent('script');
const fpc = /** @type {FirstPersonController} */ (characterController.script.create(FirstPersonController, {
    properties: {
        camera,
        jumpForce: 850
    }
}));
app.root.addChild(characterController);

/**
 * @param {string} side - The name.
 * @param {number} baseSize - The base size.
 * @param {number} stickSize - The stick size.
 */
const createJoystickUI = (side, baseSize = 100, stickSize = 60) => {
    const base = document.createElement('div');
    Object.assign(base.style, {
        display: 'none',
        position: 'absolute',
        width: `${baseSize}px`,
        height: `${baseSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(50, 50, 50, 0.5)',
        boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)'
    });

    const stick = document.createElement('div');
    Object.assign(stick.style, {
        display: 'none',
        position: 'absolute',
        width: `${stickSize}px`,
        height: `${stickSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.5)'
    });

    /**
     * @param {HTMLElement} el - The element to set position for.
     * @param {number} size - The size of the element.
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    const show = (el, size, x, y) => {
        el.style.display = 'block';
        el.style.left = `${x - size * 0.5}px`;
        el.style.top = `${y - size * 0.5}px`;
    };

    /**
     * @param {HTMLElement} el - The element to hide.
     */
    const hide = (el) => {
        el.style.display = 'none';
    };

    app.on(`${fpc.joystickEventName}:${side}`, (bx, by, sx, sy) => {
        if (bx < 0 || by < 0 || sx < 0 || sy < 0) {
            hide(base);
            hide(stick);
            return;
        }

        show(base, baseSize, bx, by);
        show(stick, stickSize, sx, sy);
    });

    document.body.append(base, stick);
};

// Create joystick UI
createJoystickUI('left');
createJoystickUI('right');

export { app };
