// @config DESCRIPTION <div style='text-align:center'><div>(<b>LMB</b>) Fly</div><div>(<b>WASDQE</b>) Move</div></div>
import { deviceType, rootPath, localImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { JoystickInput, KeyboardMouseInput, FlyCamera } = await localImport('fly-camera.mjs');

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

let input;
if (pc.platform.mobile) {
    input = new JoystickInput(canvas);
} else {
    input = new KeyboardMouseInput(canvas);
}
input.attach(canvas);

const flyCamera = new FlyCamera();
flyCamera.rotateSpeed = 0.3;
flyCamera.rotateDamping = 0.95;
flyCamera.attach(input, camera.getWorldTransform());

app.on('update', (dt) => {
    if (app.xr?.active) {
        return;
    }

    const mat = flyCamera.update(dt);
    camera.setPosition(mat.getTranslation());
    camera.setEulerAngles(mat.getEulerAngles());
});

app.on('destroy', () => {
    input.destroy();
    flyCamera.destroy();
});

export { app };
