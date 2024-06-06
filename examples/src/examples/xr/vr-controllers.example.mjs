// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';
import { rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

/**
 * @param {string} msg - The message.
 */
const message = function (msg) {
    /** @type {HTMLDivElement} */
    let el = document.querySelector('.message');
    if (!el) {
        el = document.createElement('div');
        el.classList.add('message');
        document.body.append(el);
    }
    el.textContent = msg;
};

const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window)
});

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    glb: new pc.Asset('glb', 'container', { url: rootPath + '/static/assets/models/vr-controller.glb' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // use device pixel ratio
    app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
    app.start();

    // create camera
    const c = new pc.Entity();
    c.addComponent('camera', {
        clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255)
    });
    app.root.addChild(c);

    const l = new pc.Entity();
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
    const createCube = function (x, y, z) {
        const cube = new pc.Entity();
        cube.addComponent('render', {
            type: 'box',
            material: new pc.StandardMaterial()
        });
        cube.translate(x, y, z);
        app.root.addChild(cube);
    };

    const controllers = [];
    // create controller model
    const createController = function (inputSource) {
        const entity = new pc.Entity();
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
        inputSource.on('remove', function () {
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
        const activate = function () {
            if (app.xr.isAvailable(pc.XRTYPE_VR)) {
                c.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
                    callback: function (err) {
                        if (err) message('Immersive VR failed to start: ' + err.message);
                    }
                });
            } else {
                message('Immersive VR is not available');
            }
        };

        app.mouse.on('mousedown', function () {
            if (!app.xr.active) activate();
        });

        if (app.touch) {
            app.touch.on('touchend', function (evt) {
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
        app.keyboard.on('keydown', function (evt) {
            if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
                app.xr.end();
            }
        });

        // when new input source added
        app.xr.input.on('add', function (inputSource) {
            message('Controller Added');
            createController(inputSource);
        });

        message('Tap on screen to enter VR, and see controllers');

        // update position and rotation for each controller
        app.on('update', function () {
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
});

export { app };
