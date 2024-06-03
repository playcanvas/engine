import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// create box entity
const box = new pc.Entity('cube');
box.addComponent('render', {
    type: 'box'
});
app.root.addChild(box);

// create camera entity
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.5, 0.6, 0.9)
});
app.root.addChild(camera);
camera.setPosition(0, 0, 3);

// create directional light entity
const light = new pc.Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(45, 0, 0);

function timeFunc(fn) {
    const start = performance.now();
    fn();
    return performance.now() - start;
}

const iterations = 1e6;
const average = 5;

/**
 * @type {{ pos: pc.Vec3; rot: pc.Quat; }[]}
 */
const data = [];
for (let i = 0; i < iterations; i++) {
    data.push({
        pos: new pc.Vec3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5),
        rot: new pc.Quat().setFromEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360)
    });
}

/** @type {Record<string, number[]>} */
const res = {
    setPosSetRot: [],
    setTRS: [],
    setPosRot: []
};
for (let i = 0; i < average; i++) {
    res.setPosSetRot.push(timeFunc(() => {
        for (let j = 0; j < data.length; j++) {
            box.setPosition(data[j].pos);
            box.setRotation(data[j].rot);
        }
    }));
    res.setTRS.push(timeFunc(() => {
        for (let j = 0; j < data.length; j++) {
            box.getWorldTransform().setTRS(data[j].pos, data[j].rot, pc.Vec3.ONE);
        }
    }));
    res.setPosRot.push(timeFunc(() => {
        for (let j = 0; j < data.length; j++) {
            box.setPositionAndRotation(data[j].pos, data[j].rot);
        }
    }));
}
for (const key in res) {
    console.log(key, res[key].reduce((a, b) => a + b) / res[key].length);
}


// // rotate the box according to the delta time since the last frame
// app.on('update', (/** @type {number} */ dt) => box.rotate(10 * dt, 20 * dt, 30 * dt));

export { app };
