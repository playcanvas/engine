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
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0, 0),
    farClip: 10000
});
app.root.addChild(camera);

// light
const l = new pc.Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

// placeable cone
const cone = new pc.Entity();
cone.addComponent('render', {
    type: 'cone'
});
cone.setLocalScale(0.1, 0.1, 0.1);
app.root.addChild(cone);

const tmpVec3A = new pc.Vec3();

if (app.xr.supported) {
    const activate = function () {
        if (app.xr.isAvailable(pc.XRTYPE_AR)) {
            camera.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                depthSensing: {
                    // request access to camera depth
                    usagePreference: pc.XRDEPTHSENSINGUSAGE_GPU,
                    dataFormatPreference: pc.XRDEPTHSENSINGFORMAT_F32
                },
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
                camera.camera.endXr();
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
        console.log('depth gpu optimized', app.xr.views.depthGpuOptimized);
        console.log('depth texture format', app.xr.views.depthPixelFormat);
    });
    app.xr.on('end', function () {
        message('Immersive AR session has ended');
    });
    app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
        if (available) {
            if (!app.xr.views.supportedDepth) {
                message('AR Camera Depth is not supported');
            } else {
                message('Touch screen to start AR session');
            }
        } else {
            message('Immersive AR is not available');
        }
    });

    let selecting = false;
    let selectingTime = 0;
    const selectingDelay = 100;

    app.xr.input.on('select', () => {
        selecting = true;
        selectingTime = Date.now();
    });

    app.on('update', () => {
        // if camera depth is available
        if (app.xr.views.availableDepth) {
            const view = app.xr.views.list[0];
            const depth = view.getDepth(0.5, 0.5);

            if (depth) {
                tmpVec3A.copy(camera.forward);
                tmpVec3A.mulScalar(depth);
                tmpVec3A.add(camera.getPosition());
                tmpVec3A.y += 0.05; // offset based on cone scale

                cone.enabled = true;
                cone.setLocalPosition(tmpVec3A);

                if (selecting && Date.now() - selectingTime < selectingDelay) {
                    selecting = false;
                    const obj = cone.clone();
                    app.root.addChild(obj);
                }
            } else {
                cone.enabled = false;
            }
        } else {
            cone.enabled = false;
        }
    });

    if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
        message('Immersive AR is not available');
    } else if (!app.xr.views.supportedDepth) {
        message('AR Camera Depth is not supported');
    } else {
        message('Touch screen to start AR session');
    }
} else {
    message('WebXR is not supported');
}

export { app };
