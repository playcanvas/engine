// @config DESCRIPTION <div style='text-align:center'><div>(<b>LMB</b>) Fly</div><div>(<b>WASDQE</b>) Move</div></div>
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    statue: new pc.Asset('statue', 'container', { url: `${rootPath}/static/assets/models/statue.glb` })
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

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

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight.set(0.4, 0.4, 0.4);

app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.4;
app.scene.envAtlas = assets.helipad.resource;

// Create a directional light
const light = new pc.Entity();
light.addComponent('light');
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const statue = assets.statue.resource.instantiateRenderEntity();
statue.setLocalPosition(0, -0.5, 0);
app.root.addChild(statue);

const camera = new pc.Entity();
camera.addComponent('camera');
camera.addComponent('script');
camera.setPosition(0, 20, 30);
camera.setEulerAngles(-20, 0, 0);
app.root.addChild(camera);

/** @type {pc.Input} */
let input;
if (pc.platform.mobile) {
    input = new pc.JoystickInput();
} else {
    input = new pc.KeyboardMouseInput();
}
// const input = new pc.KeyboardMouseInput();
input.attach(canvas);

const cam = new pc.OrbitCamera();
cam.rotateSpeed = 0.3;
cam.rotateDamping = 0.95;
cam.attach(camera.getWorldTransform());

/**
 * Calculate the bounding box of an entity.
 *
 * @param {pc.BoundingBox} bbox - The bounding box.
 * @param {pc.Entity} entity - The entity.
 * @returns {pc.BoundingBox} The bounding box.
 */
const calcEntityAABB = (bbox, entity) => {
    bbox.center.set(0, 0, 0);
    bbox.halfExtents.set(0, 0, 0);
    entity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((/** @type {pc.MeshInstance} */ mi) => {
            bbox.add(mi.aabb);
        });
    });
    return bbox;
};
cam.focus(camera.getPosition(), calcEntityAABB(new pc.BoundingBox(), statue).center);

app.on('update', (dt) => {
    if (app.xr?.active) {
        return;
    }

    const frame = input.frame();
    const mat = cam.update(input instanceof pc.JoystickInput ? {
        rotate: frame.rotate,
        pointer: [0, 0],
        zoom: [-frame.translate[2] * 10]
    } : {
        rotate: frame.rotate,
        pointer: frame.pointer ?? [0, 0],
        zoom: frame.zoom ?? [0]
    }, camera.camera, dt);
    camera.setPosition(mat.getTranslation());
    camera.setEulerAngles(mat.getEulerAngles());
});

app.on('destroy', () => {
    input.destroy();
    cam.destroy();
});

export { app };
