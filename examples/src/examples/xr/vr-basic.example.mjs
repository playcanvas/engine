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

// use device pixel ratio
app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

app.start();

// create camera
const c = new pc.Entity();
c.addComponent('camera', {
    clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255),
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
    cube.setLocalScale(1, 1, 1);
    cube.translate(x, y, z);
    app.root.addChild(cube);
};

// create a grid of cubes
const SIZE = 16;
for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
        createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
    }
}

if (app.xr.supported) {
    const activate = function () {
        if (app.xr.isAvailable(pc.XRTYPE_VR)) {
            c.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
                callback: function (err) {
                    if (err) message('WebXR Immersive VR failed to start: ' + err.message);
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

    app.xr.on('start', function () {
        message('Immersive VR session has started');
    });
    app.xr.on('end', function () {
        message('Immersive VR session has ended');
    });
    app.xr.on('available:' + pc.XRTYPE_VR, function (available) {
        message('Immersive VR is ' + (available ? 'available' : 'unavailable'));
    });

    if (!app.xr.isAvailable(pc.XRTYPE_VR)) {
        message('Immersive VR is not available');
    }
} else {
    message('WebXR is not supported');
}

export { app };
