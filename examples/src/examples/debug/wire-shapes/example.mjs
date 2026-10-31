// @config
//
// Every shape a WireRenderer can draw, animated. Sizes, colors, orientations and tessellation are
// driven per cell, so each shape is shown across the range of values it accepts.

import {
    AppBase,
    AppOptions,
    BoundingBox,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mat4,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    TouchDevice,
    Vec2,
    Vec3,
    WireRenderer,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));
app.start();

data.set('settings', {
    segments: 20,
    depthTest: true,
    animate: true
});

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.02, 0.025, 0.04),
    nearClip: 0.1,
    farClip: 200
});
camera.addComponent('script');
camera.setLocalPosition(0, 0, 26);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 0, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-80, 80);
cameraControls.zoomRange = new Vec2(8, 60);

const wire = new WireRenderer(app);

// A spot light, so the light() helper has something real to visualize
const spotLight = new Entity('spot');
spotLight.addComponent('light', {
    type: 'spot',
    color: new Color(1, 0.7, 0.2),
    range: 2.6,
    innerConeAngle: 10,
    outerConeAngle: 30
});
app.root.addChild(spotLight);

// Scratch values, so the update loop allocates nothing
const a = new Vec3();
const b = new Vec3();
const axis = new Vec3();
const cellColor = new Color(1, 1, 1, 1);
const SPOKES = 8;
const packedPositions = new Float32Array(SPOKES * 2 * 3);
const packedColors = new Float32Array(SPOKES * 2 * 4);
const polyPoints = [];
const loopPoints = [];
const crossPoints = [];
const crossColors = [];
for (let i = 0; i < 16; i++) {
    polyPoints.push(new Vec3());
    if (i < 7) loopPoints.push(new Vec3());
    if (i < 4) {
        crossPoints.push(new Vec3());
        crossColors.push(new Color());
    }
}
const aabb = new BoundingBox();
const transform = new Mat4();
const rotation = new Quat();
const projection = new Mat4();
const ONE = new Vec3(1, 1, 1);

/**
 * Every shape, in the order they are laid out. Each receives the center of its cell, a 0..1
 * pulse and the elapsed time.
 *
 * @type {{ name: string, draw: (center: Vec3, pulse: number, time: number) => void }[]}
 */
const shapes = [
    {
        name: 'line',
        draw: (center, pulse) => {
            a.set(center.x, center.y - pulse, center.z);
            b.set(center.x, center.y + pulse, center.z);
            wire.line(a, b);
        }
    },
    {
        name: 'lines',
        draw: (center, pulse) => {
            // per-point colors interpolate along each segment, so this reads as a gradient
            crossPoints[0].set(center.x - pulse, center.y - pulse, center.z);
            crossPoints[1].set(center.x + pulse, center.y + pulse, center.z);
            crossPoints[2].set(center.x - pulse, center.y + pulse, center.z);
            crossPoints[3].set(center.x + pulse, center.y - pulse, center.z);
            crossColors[0].set(1, 0.2, 0.2, 1);
            crossColors[1].set(0.2, 0.5, 1, 1);
            crossColors[2].set(0.2, 0.5, 1, 1);
            crossColors[3].set(1, 0.2, 0.2, 1);
            wire.lines(crossPoints, crossColors);
        }
    },
    {
        name: 'linesPacked',
        draw: (center, pulse, time) => {
            // the packed form avoids reading Vec3 and Color instances at all, and carries a color
            // per vertex, so each spoke fades from white at the hub to its own tip color
            for (let spoke = 0; spoke < SPOKES; spoke++) {
                const angle = (spoke / SPOKES) * Math.PI * 2 + time * 0.6;
                const hub = spoke * 2;
                const tip = hub + 1;

                packedPositions[hub * 3] = center.x;
                packedPositions[hub * 3 + 1] = center.y;
                packedPositions[hub * 3 + 2] = center.z;
                packedPositions[tip * 3] = center.x + Math.sin(angle) * pulse * 1.4;
                packedPositions[tip * 3 + 1] = center.y + Math.cos(angle) * pulse * 1.4;
                packedPositions[tip * 3 + 2] = center.z;

                packedColors[hub * 4] = 1;
                packedColors[hub * 4 + 1] = 1;
                packedColors[hub * 4 + 2] = 1;
                packedColors[hub * 4 + 3] = 1;
                packedColors[tip * 4] = 0.5 + 0.5 * Math.sin(angle);
                packedColors[tip * 4 + 1] = 0.5 + 0.5 * Math.sin(angle + 2.1);
                packedColors[tip * 4 + 2] = 0.5 + 0.5 * Math.sin(angle + 4.2);
                packedColors[tip * 4 + 3] = 1;
            }
            wire.linesPacked(packedPositions, packedColors);
        }
    },
    {
        name: 'polyline',
        draw: (center, pulse, time) => {
            for (let i = 0; i < 16; i++) {
                const t = i / 15;
                polyPoints[i].set(
                    center.x + (t - 0.5) * 2.4,
                    center.y + Math.sin(t * Math.PI * 2 + time * 2) * pulse * 0.8,
                    center.z
                );
            }
            wire.polyline(polyPoints);
        }
    },
    {
        name: 'loop',
        draw: (center, pulse, time) => {
            for (let i = 0; i < 7; i++) {
                const angle = (i / 7) * Math.PI * 2 + time * 0.5;
                loopPoints[i].set(
                    center.x + Math.sin(angle) * pulse * 1.2,
                    center.y + Math.cos(angle) * pulse * 1.2,
                    center.z
                );
            }
            wire.loop(loopPoints);
        }
    },
    {
        name: 'box',
        draw: (center, pulse, time) => {
            // an oriented box, by composing a rotation into the renderer transform
            rotation.setFromEulerAngles(time * 30, time * 45, 0);
            transform.setTRS(center, rotation, ONE);
            wire.transform = transform;
            aabb.center.set(0, 0, 0);
            aabb.halfExtents.set(pulse, pulse * 0.7, pulse * 0.5);
            wire.box(aabb);
        }
    },
    {
        name: 'boxMinMax',
        draw: (center, pulse) => {
            a.set(center.x - pulse, center.y - pulse, center.z - pulse);
            b.set(center.x + pulse, center.y + pulse, center.z + pulse);
            wire.boxMinMax(a, b);
        }
    },
    {
        name: 'sphere',
        draw: (center, pulse) => wire.sphere(center, pulse)
    },
    {
        name: 'circle',
        draw: (center, pulse, time) => {
            axis.set(Math.sin(time), 1, Math.cos(time * 0.7)).normalize();
            wire.circle(center, axis, pulse * 1.2);
        }
    },
    {
        name: 'cylinder',
        draw: (center, pulse, time) => {
            axis.set(Math.sin(time * 0.6), 1, 0)
                .normalize()
                .mulScalar(1.1);
            a.copy(center).sub(axis);
            b.copy(center).add(axis);
            wire.cylinder(a, b, pulse * 0.7);
        }
    },
    {
        name: 'capsule',
        draw: (center, pulse, time) => {
            axis.set(0, 1, Math.sin(time * 0.8) * 0.6)
                .normalize()
                .mulScalar(0.8);
            a.copy(center).sub(axis);
            b.copy(center).add(axis);
            wire.capsule(a, b, pulse * 0.6);
        }
    },
    {
        name: 'cone',
        draw: (center, pulse, time) => {
            axis.set(Math.sin(time * 0.9) * 0.5, -1, 0).normalize();
            a.set(center.x, center.y + 1.2, center.z);
            wire.cone(a, axis, 12 + pulse * 28, 2.4);
        }
    },
    {
        name: 'plane',
        draw: (center, pulse, time) => {
            // a square has a definite orientation, and the one derived from a normal alone is not
            // continuous as that normal swings around, so it is rotated with a transform instead
            rotation.setFromEulerAngles(time * 25, time * 18, time * 12);
            transform.setTRS(center, rotation, ONE);
            wire.transform = transform;
            wire.plane(Vec3.ZERO, Vec3.UP, pulse * 2.4);
        }
    },
    {
        name: 'point',
        draw: (center, pulse) => wire.point(center, pulse * 3.4)
    },
    {
        name: 'arrow',
        draw: (center, pulse, time) => {
            axis.set(Math.sin(time * 1.3), Math.cos(time * 0.9), Math.sin(time * 0.5))
                .normalize()
                .mulScalar(pulse * 1.6);
            a.copy(center).sub(axis);
            b.copy(center).add(axis);
            wire.arrow(a, b);
        }
    },
    {
        name: 'axes',
        draw: (center, pulse, time) => {
            // axes() is always red, green and blue, so it ignores the renderer color. The matrix
            // is passed directly and the renderer transform left alone, or it would apply twice.
            rotation.setFromEulerAngles(time * 20, time * 35, time * 15);
            transform.setTRS(center, rotation, ONE);
            wire.axes(transform, pulse * 2);
        }
    },
    {
        name: 'frustum',
        draw: (center, pulse, time) => {
            // a bare projection matrix places the frustum at the origin looking down -z, so the
            // renderer transform is used to move it into the cell
            projection.setPerspective(30 + pulse * 40, 1.4, 0.5, 3);
            rotation.setFromEulerAngles(-20, time * 25, 0);
            transform.setTRS(center, rotation, ONE);
            wire.transform = transform;
            wire.frustum(projection);
        }
    },
    {
        name: 'light',
        draw: (center, pulse, time) => {
            // a light shines along the negative y-axis of its entity
            spotLight.setLocalPosition(center.x, center.y + 1.3, center.z);
            spotLight.setLocalEulerAngles(Math.sin(time * 0.8) * 25, 0, Math.cos(time * 0.6) * 25);
            spotLight.light.outerConeAngle = 12 + pulse * 28;
            spotLight.light.color = cellColor;
            wire.light(spotLight.light);
        }
    }
];

const COLUMNS = 6;
const ROWS = Math.ceil(shapes.length / COLUMNS);
const SPACING = 4.4;
const cell = new Vec3();

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    if (data.get('settings.animate')) {
        time += dt;
    }

    wire.segments = data.get('settings.segments');
    wire.depthTest = data.get('settings.depthTest');

    for (let i = 0; i < shapes.length; i++) {
        const column = i % COLUMNS;
        const row = Math.floor(i / COLUMNS);

        // laid out as a wall facing the camera, so every cell is the same size on screen
        cell.set((column - (COLUMNS - 1) / 2) * SPACING, ((ROWS - 1) / 2 - row) * SPACING, 0);

        // each cell runs the same animation at its own phase
        const phase = i * 0.7;
        const pulse = 0.7 + Math.sin(time * 1.5 + phase) * 0.3;

        cellColor.set(
            0.5 + 0.5 * Math.sin(phase + time * 0.4),
            0.5 + 0.5 * Math.sin(phase + time * 0.4 + 2.1),
            0.5 + 0.5 * Math.sin(phase + time * 0.4 + 4.2),
            1
        );

        // the transform is per shape, so it is cleared before every cell
        wire.transform = null;
        wire.color = cellColor;

        shapes[i].draw(cell, pulse, time);
    }
});
