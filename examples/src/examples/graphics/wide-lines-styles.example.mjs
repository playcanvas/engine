// @config
//
// Compare WideLine styling in one instanced draw call, including variable widths, color gradients,
// caps, joins, dashes, round dots, tapered arrows and screen-space or world-space widths.

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
    LINEWIDTH_SCREEN,
    LINEWIDTH_WORLD,
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
    clearColor: new Color(0.02, 0.025, 0.04),
    nearClip: 0.1,
    farClip: 100
});
camera.addComponent('script');
camera.setLocalPosition(0, 1, 24);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 0, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-80, 80);
cameraControls.zoomRange = new Vec2(10, 45);

const renderer = new WideLineRenderer(app);
const styledLines = [];

data.set('settings', {
    worldSpaceWidths: false
});

const styles = [
    { width: 3, cap: LINECAP_BUTT, join: LINEJOIN_MITER, phase: 0 },
    { width: 3, cap: LINECAP_BUTT, join: LINEJOIN_MITER, phase: 0, doubleArrow: true },
    { width: 10, cap: LINECAP_ROUND, join: LINEJOIN_ROUND },
    { width: 10, cap: LINECAP_SQUARE, join: LINEJOIN_BEVEL },
    { width: 7, cap: LINECAP_BUTT, join: LINEJOIN_MITER, dashLength: 0.65, gapLength: 0.35 },
    { width: 10, cap: LINECAP_ROUND, join: LINEJOIN_MITER, dashLength: 0.001, gapLength: 0.5 },
    { width: 12, cap: LINECAP_ROUND, join: LINEJOIN_ROUND, variable: true },
    { width: 16, cap: LINECAP_ROUND, join: LINEJOIN_ROUND, arrow: true }
];

for (let row = 0; row < styles.length; row++) {
    const style = styles[row];
    const pointCount = 216;
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);
    const widths = new Float32Array(pointCount);

    for (let point = 0; point < pointCount; point++) {
        const t = point / (pointCount - 1);
        const position = point * 3;
        positions[position] = (t - 0.5) * 16;
        positions[position + 1] = 5.7 - row * 1.9 + Math.sin(t * Math.PI * 3 + (style.phase ?? row * 0.35)) * 0.5;
        positions[position + 2] = Math.cos(t * Math.PI * 2 + row) * 0.4;

        const color = point * 3;
        colors[color] = 0.15 + 0.75 * t;
        colors[color + 1] = 0.8 - row * 0.08;
        colors[color + 2] = 1 - 0.7 * t + row * 0.04;

        widths[point] = style.variable ? 2 + Math.sin(t * Math.PI) * style.width : style.width;
        if (style.doubleArrow) {
            const edge = Math.min(t, 1 - t);
            widths[point] = edge < 0.06 ? (36 * edge) / 0.06 : style.width;
        }
        if (style.arrow && t > 0.82) {
            widths[point] = (style.width * (1 - t)) / 0.18;
        }
    }

    const line = new WideLine();
    line.set(positions, colors, widths);
    line.cap = style.cap;
    line.join = style.join;
    line.dashLength = style.dashLength ?? 0;
    line.gapLength = style.gapLength ?? 0;
    renderer.add(line);

    const worldWidths = new Float32Array(pointCount);
    for (let point = 0; point < pointCount; point++) {
        worldWidths[point] = widths[point] * 0.03;
    }
    styledLines.push({ line, screenWidths: widths, worldWidths });
}

const updateWidthUnits = () => {
    const worldSpace = data.get('settings.worldSpaceWidths');
    renderer.widthUnits = worldSpace ? LINEWIDTH_WORLD : LINEWIDTH_SCREEN;

    for (let i = 0; i < styledLines.length; i++) {
        const entry = styledLines[i];
        entry.line.setWidths(worldSpace ? entry.worldWidths : entry.screenWidths);
    }
};

data.on('settings.worldSpaceWidths:set', updateWidthUnits);
updateWidthUnits();

app.on('destroy', () => renderer.destroy());
