// @config
//
// Shows per-gaussian blind data stored in a SOG v3 file, used to add a shine to the logo and
// recolor the rest of the splat with hue waves running out from the logo. The View option shows the
// blind fields themselves.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    Mouse,
    RESOLUTION_AUTO,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import shaderGlslVert from './shader.glsl.vert';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [CameraComponentSystem, ScriptComponentSystem, GSplatComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    logo: new Asset('logo', 'gsplat', { url: './assets/splats/playcanvas-logo-v3/meta.json' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

const logo = new Entity('logo');
logo.addComponent('gsplat', { asset: assets.logo });

// The modifier runs when the splats are copied to the work buffer. It reads two blind fields of
// each splat: 'logo' (1 on the white logo) and 'edge' (the distance across the front face to the
// logo outline, 0 to 1).
logo.gsplat.setWorkBufferModifier({ glsl: shaderGlslVert, wgsl: shaderWgslVert });
app.root.addChild(logo);

// Create an Entity with a camera component, looking at the front face of the pillow
const focus = new Vec3().copy(/** @type {any} */ (assets.logo.resource).aabb.center);
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.12, 0.12, 0.14),
    toneMapping: TONEMAP_ACES
});
camera.setLocalPosition(focus.x + 2.5, focus.y + 0.8, focus.z + 5.5);
app.root.addChild(camera);

camera.addComponent('script');
camera.script.create(CameraControls, {
    properties: {
        enableFly: false,
        focusPoint: focus,
        pitchRange: new Vec2(-90, 90),
        zoomRange: new Vec2(2, 20)
    }
});

data.set('view', 0);
data.set('animate', true);
data.set('shine', 1);
data.set('hue', 0);
data.set('waves', 1);

// time only advances while animating, so pausing stops both the shine and the hue cycling
let time = 0;
const updateParameters = () => {
    logo.gsplat.setParameter('uTime', time);
    logo.gsplat.setParameter('uShine', data.get('shine'));
    logo.gsplat.setParameter('uHue', ((data.get('hue') + time * 30) * Math.PI) / 180);
    logo.gsplat.setParameter('uWaves', data.get('waves'));
    logo.gsplat.setParameter('uView', data.get('view'));
};
updateParameters();
data.on('*:set', updateParameters);

// setting a parameter copies the splats to the work buffer again, so do it every frame only while
// animating
app.on('update', (dt) => {
    if (data.get('animate')) {
        time += dt;
        updateParameters();
    }
});

export { app };
