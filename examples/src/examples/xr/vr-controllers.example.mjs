import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    KEY_ESCAPE,
    Keyboard,
    LightComponentSystem,
    ModelComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
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

createOptions.componentSystems = [
    RenderComponentSystem,
    ModelComponentSystem,
    CameraComponentSystem,
    LightComponentSystem
];
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

const assets = {
    glb: new Asset('glb', 'container', { url: './assets/models/vr-controller.glb' })
};

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// create camera
const c = new Entity();
c.addComponent('camera', {
    clearColor: new Color(44 / 255, 62 / 255, 80 / 255)
});
app.root.addChild(c);

const l = new Entity();
l.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowBias: 0.05,
    normalOffsetBias: 0.05,
    shadowDistance: 5
});
l.setEulerAngles(45, 135, 0);
app.root.addChild(l);

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
    cube.translate(x, y, z);
    app.root.addChild(cube);
};

const controllers = [];
// create controller model
const createController = inputSource => {
    const entity = new Entity();
    entity.addComponent('model', {
        type: 'asset',
        asset: assets.glb.resource.model,
        castShadows: true
    });
    app.root.addChild(entity);
    // @ts-ignore engine-tsd
    entity.inputSource = inputSource;
    controllers.push(entity);

    // destroy input source related entity
    // when input source is removed
    inputSource.on('remove', () => {
        controllers.splice(controllers.indexOf(entity), 1);
        entity.destroy();
    });
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

    // when new input source added
    app.xr.input.on('add', inputSource => {
        message('Controller Added');
        createController(inputSource);
    });

    message('Tap on screen to enter VR, and see controllers');

    // update position and rotation for each controller
    app.on('update', () => {
        for (let i = 0; i < controllers.length; i++) {
            const inputSource = controllers[i].inputSource;
            if (inputSource.grip) {
                // some controllers can be gripped
                controllers[i].enabled = true;
                controllers[i].setLocalPosition(inputSource.getLocalPosition());
                controllers[i].setLocalRotation(inputSource.getLocalRotation());
            } else {
                // some controllers cannot be gripped
                controllers[i].enabled = false;
            }
        }
    });
} else {
    message('WebXR is not supported');
}
