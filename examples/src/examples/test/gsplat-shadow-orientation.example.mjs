// @config
//
// Visual cross-API test for the orientation of gaussian splat footprints in shadow maps. A row of
// long, thin splats floats above a ground plane, each rotated by a different angle around the
// vertical axis. A horizontal needle casts a shadow parallel to itself for any light direction, so
// every shadow must be parallel to the needle above it, identically on WebGL2 and WebGPU, and with
// both the CPU-sort and GPU-sort renderers.
//
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    BoundingBox,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatContainer,
    GSplatFormat,
    LightComponentSystem,
    PIXELFORMAT_RGBA32F,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    StandardMaterial,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],
    antialias: false
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', GSPLAT_RENDERER_AUTO);

// dataCenter: center.xyz + rotation angle around the Y axis (radians) in w
// dataColor: color.rgb
const format = new GSplatFormat(
    device,
    [
        { name: 'dataCenter', format: PIXELFORMAT_RGBA32F },
        { name: 'dataColor', format: PIXELFORMAT_RGBA32F }
    ],
    {
        readGLSL: `
        vec3 getCenter() { return loadDataCenter().xyz; }
        vec4 getColor() { return vec4(loadDataColor().rgb, 1.0); }
        vec3 getScale() { return vec3(0.5, 0.015, 0.015); }
        vec4 getRotation() {
            float halfAngle = 0.5 * loadDataCenter().w;
            return vec4(cos(halfAngle), 0.0, sin(halfAngle), 0.0);  // (w, x, y, z)
        }
    `,
        readWGSL: `
        fn getCenter() -> vec3f { return loadDataCenter().xyz; }
        fn getColor() -> vec4f { return vec4f(loadDataColor().rgb, 1.0); }
        fn getScale() -> vec3f { return vec3f(0.5, 0.015, 0.015); }
        fn getRotation() -> vec4f {
            let halfAngle = 0.5 * loadDataCenter().w;
            return vec4f(cos(halfAngle), 0.0, sin(halfAngle), 0.0);  // (w, x, y, z)
        }
    `
    }
);

// needle angles in degrees, laid out along the X axis
const angles = [0, 30, 60, 90, 120, 150];
const spacing = 1.4;
const height = 1.5;

const container = new GSplatContainer(device, angles.length, format);
const centerData = container.getTexture('dataCenter').lock();
const colorData = container.getTexture('dataColor').lock();
const centers = container.centers;

angles.forEach((angle, i) => {
    const x = (i - (angles.length - 1) / 2) * spacing;
    centerData.set([x, height, 0, (angle * Math.PI) / 180], i * 4);
    colorData.set([1, 0.3 + 0.7 * (i / (angles.length - 1)), 0.1, 1], i * 4);
    centers.set([x, height, 0], i * 3);
});

container.getTexture('dataCenter').unlock();
container.getTexture('dataColor').unlock();
container.aabb = new BoundingBox(new Vec3(0, height, 0), new Vec3(5, 1, 1));

const splat = new Entity('needles');
splat.addComponent('gsplat', {
    resource: container,
    castShadows: true
});
app.root.addChild(splat);

// ground plane receiving the shadows
const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.8, 0.8, 0.8);
groundMaterial.update();
const ground = new Entity('ground');
ground.addComponent('render', {
    type: 'plane',
    material: groundMaterial,
    castShadows: false
});
ground.setLocalScale(30, 1, 30);
app.root.addChild(ground);

// directional light tilted so the shadows land beside the needles rather than under them
const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    intensity: 1,
    castShadows: true,
    shadowBias: 0.1,
    normalOffsetBias: 0.05,
    shadowDistance: 20,
    shadowResolution: 2048,
    shadowType: SHADOW_PCF3_32F
});
light.setEulerAngles(35, 0, 0);
app.root.addChild(light);

app.scene.ambientLight = new Color(0.4, 0.4, 0.4);

// camera looks at the needles from a 45 degree elevation
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.25),
    fov: 45
});
camera.setLocalPosition(0, 7.8, 6.5);
camera.addComponent('script');
camera.script?.create(CameraControls, {
    properties: {
        enableFly: false,
        focusPoint: new Vec3(0, 0.75, -0.55),
        zoomRange: new Vec2(2, 20)
    }
});
app.root.addChild(camera);

export { app };
