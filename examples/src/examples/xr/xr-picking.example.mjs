import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    KEY_ESCAPE,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    Ray,
    RenderComponentSystem,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    Vec3,
    XRSPACE_LOCAL,
    XRTYPE_VR,
    XrManager,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

/**
 * @param {string} msg - The message.
 */
const message = msg => {
    /** @type {HTMLDivElement} */
    let el = document.querySelector('.message');
    if (!el) {
        el = document.createElement('div');
        el.classList.add('message');
        document.body.append(el);
    }
    el.textContent = msg;
};

const gfxOptions = {
    deviceTypes: [deviceType],
    alpha: true
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = window.devicePixelRatio;

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(canvas);
createOptions.touch = new TouchDevice(canvas);
createOptions.keyboard = new Keyboard(window);
createOptions.xr = XrManager;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

// create camera
const c = new Entity();
c.addComponent('camera', {
    clearColor: new Color(44 / 255, 62 / 255, 80 / 255),
    farClip: 10000
});
app.root.addChild(c);

const l = new Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

/** @type {Entity[]} */
const cubes = [];

/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 */
const createCube = (x, y, z) => {
    const cube = new Entity();
    cube.addComponent('render', {
        type: 'box',
        material: new StandardMaterial()
    });
    cube.setLocalScale(1, 1, 1);
    cube.translate(x, y, z);
    app.root.addChild(cube);
    cubes.push(cube);
};

// create a grid of cubes
const SIZE = 4;
for (let x = 0; x <= SIZE; x++) {
    for (let y = 0; y <= SIZE; y++) {
        createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
    }
}

if (app.xr.supported) {
    const activate = () => {
        if (app.xr.isAvailable(XRTYPE_VR)) {
            c.camera.startXr(XRTYPE_VR, XRSPACE_LOCAL, {
                callback: err => {
                    if (err) message(`Immersive VR failed to start: ${err.message}`);
                }
            });
        } else {
            message('Immersive VR is not available');
        }
    };

    app.mouse.on('mousedown', () => {
        if (!app.xr.active) activate();
    });

    if (app.touch) {
        app.touch.on('touchend', evt => {
            if (!app.xr.active) {
                // if not in VR, activate
                activate();
            } else {
                // otherwise reset camera
                c.camera.endXr();
            }

            evt.event.preventDefault();
            evt.event.stopPropagation();
        });
    }

    // end session by keyboard ESC
    app.keyboard.on('keydown', evt => {
        if (evt.key === KEY_ESCAPE && app.xr.active) {
            app.xr.end();
        }
    });

    message('Tap on screen to enter VR, and then pick objects');

    // when input source is triggers select
    // pick closest box and change its color
    const ray = new Ray();
    app.xr.input.on('select', inputSource => {
        let candidate = null;
        let candidateDist = Infinity;

        for (let i = 0; i < cubes.length; i++) {
            const mesh = cubes[i].render.meshInstances[0];

            // check if mesh bounding box intersects with input source ray
            ray.set(inputSource.getOrigin(), inputSource.getDirection());
            if (mesh.aabb.intersectsRay(ray)) {
                // check distance to camera
                const dist = mesh.aabb.center.distance(c.getPosition());

                // if it is closer than previous distance
                if (dist < candidateDist) {
                    // set new candidate
                    candidate = mesh;
                    candidateDist = dist;
                }
            }
        }

        // if we have picked candidate
        if (candidate) {
            // randomize its color
            candidate.material.diffuse.set(Math.random(), Math.random(), Math.random());
            candidate.material.update();
        }
    });

    const tmpVec = new Vec3();

    // on each app update
    // render input source rays as a line
    app.on('update', () => {
        for (let i = 0; i < app.xr.input.inputSources.length; i++) {
            const inputSource = app.xr.input.inputSources[i];
            const direction = inputSource.getDirection();
            const origin = inputSource.getOrigin();
            const color = inputSource.selecting ? Color.GREEN : Color.WHITE;

            tmpVec.copy(direction).mulScalar(100).add(origin);

            app.drawLine(inputSource.getOrigin(), tmpVec, color);
        }
    });
} else {
    message('WebXR is not supported');
}
