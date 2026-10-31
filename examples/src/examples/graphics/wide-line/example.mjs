// @config
//
// Explore a single curved WideLine and adjust its geometry, variable width, color gradient, caps,
// joins and dash pattern in real time.

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LINECAP_BUTT,
    LINECAP_ROUND,
    LINECAP_SQUARE,
    LINEJOIN_BEVEL,
    LINEJOIN_MITER,
    LINEJOIN_ROUND,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    TouchDevice,
    Vec2,
    Vec3,
    WideLine,
    WideLineRenderer,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));
app.start();

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.025, 0.035, 0.055),
    nearClip: 0.1,
    farClip: 100
});
camera.addComponent('script');
camera.setLocalPosition(12.5, 4, 12.5);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 0, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-85, 85);
cameraControls.zoomRange = new Vec2(5, 40);

const renderer = new WideLineRenderer(app);
const line = new WideLine();
renderer.add(line);

let pointCount = 0;
let positions = new Float32Array(0);
let colors = new Float32Array(0);
let widths = new Float32Array(0);

const capStyles = {
    Butt: LINECAP_BUTT,
    Square: LINECAP_SQUARE,
    Round: LINECAP_ROUND
};
const joinStyles = {
    Miter: LINEJOIN_MITER,
    Bevel: LINEJOIN_BEVEL,
    Round: LINEJOIN_ROUND
};

data.set('settings', {
    points: 96,
    amplitude: 2.2,
    frequency: 1.5,
    startWidth: 4,
    endWidth: 18,
    startColor: [0.1, 0.7, 1],
    endColor: [1, 0.15, 0.45],
    cap: 'Round',
    join: 'Round',
    closed: false,
    dashLength: 0,
    gapLength: 0,
    dashOffset: 0
});

const applySettings = () => {
    const settings = data.get('settings');
    const startColor = settings.startColor;
    const endColor = settings.endColor;

    if (pointCount !== settings.points) {
        pointCount = settings.points;
        positions = new Float32Array(pointCount * 3);
        colors = new Float32Array(pointCount * 3);
        widths = new Float32Array(pointCount);
    }

    for (let i = 0; i < pointCount; i++) {
        const t = i / (pointCount - 1);
        const angle = t * Math.PI * 2 * settings.frequency;
        const position = i * 3;
        positions[position] = (t - 0.5) * 16;
        positions[position + 1] = Math.sin(angle) * settings.amplitude;
        positions[position + 2] = Math.cos(angle * 0.5) * 1.5;

        widths[i] = settings.startWidth + (settings.endWidth - settings.startWidth) * t;

        const color = i * 3;
        colors[color] = startColor[0] + (endColor[0] - startColor[0]) * t;
        colors[color + 1] = startColor[1] + (endColor[1] - startColor[1]) * t;
        colors[color + 2] = startColor[2] + (endColor[2] - startColor[2]) * t;
    }

    line.set(positions, colors, widths);
    line.cap = capStyles[settings.cap];
    line.join = joinStyles[settings.join];
    line.closed = settings.closed;
    line.dashLength = settings.dashLength;
    line.gapLength = settings.gapLength;
    line.dashOffset = settings.dashOffset;
};

data.on('*:set', applySettings);
applySettings();

app.on('destroy', () => renderer.destroy());
