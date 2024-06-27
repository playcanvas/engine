// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';

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
        el.style.position = 'absolute';
        el.style.bottom = '96px';
        el.style.right = '0';
        el.style.padding = '8px 16px';
        el.style.fontFamily = 'Helvetica, Arial, sans-serif';
        el.style.color = '#fff';
        el.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        document.body.append(el);
    }
    el.textContent = msg;
};

const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: { alpha: true }
});

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// use device pixel ratio
app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

app.start();

// create camera
const c = new pc.Entity();
c.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0, 0),
    farClip: 10000
});
app.root.addChild(c);

const l = new pc.Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

const material = new pc.StandardMaterial();

/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 */
const createCube = function (x, y, z) {
    const cube = new pc.Entity();
    cube.addComponent('render', {
        type: 'box'
    });
    cube.render.material = material;
    cube.setLocalScale(0.5, 0.5, 0.5);
    cube.translate(x * 0.5, y, z * 0.5);
    app.root.addChild(cube);
};

// create a grid of cubes
const SIZE = 4;
for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
        createCube(2 * x - SIZE, 0.25, 2 * y - SIZE);
    }
}

if (app.xr.supported) {
    const activate = function () {
        if (app.xr.isAvailable(pc.XRTYPE_AR)) {
            c.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                cameraColor: true, // request access to camera color
                callback: function (err) {
                    if (err) message('WebXR Immersive AR failed to start: ' + err.message);
                }
            });
        } else {
            message('Immersive AR is not available');
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

    app.xr.on('start', function () {
        message('Immersive AR session has started');
    });
    app.xr.on('end', function () {
        message('Immersive AR session has ended');
    });
    app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
        if (available) {
            if (!app.xr.views.supportedColor) {
                message('AR Camera Color is not supported');
            } else {
                message('Touch screen to start AR session');
            }
        } else {
            message('Immersive AR is not available');
        }
    });

    app.on('update', () => {
        // if camera color is available
        if (app.xr.views.availableColor) {
            for (let i = 0; i < app.xr.views.list.length; i++) {
                const view = app.xr.views.list[i];
                if (!view.textureColor)
                    // check if color texture is available
                    continue;

                // apply camera color texture to material diffuse channel
                if (!material.diffuseMap) {
                    material.diffuseMap = view.textureColor;
                    material.update();
                }

                // debug draw camera color texture on the screen
                app.drawTexture(0.5, -0.5, 1, 1, view.textureColor);
            }
        }
    });

    app.xr.on('end', () => {
        if (!material.diffuseMap) return;

        // clear camera color texture when XR session ends
        material.diffuseMap = null;
        material.update();
    });

    if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
        message('Immersive AR is not available');
    } else if (!app.xr.views.supportedColor) {
        message('AR Camera Color is not supported');
    } else {
        message('Touch screen to start AR session');
    }
} else {
    message('WebXR is not supported');
}

export { app };
