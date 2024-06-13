// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';
import files from 'examples/files';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// create UI
// html
const div = document.createElement('div');
div.innerHTML = files['ui.html'];
document.body.appendChild(div);
// css
const css = document.createElement('style');
css.innerHTML = files['ui.css'];
document.head.appendChild(css);

/**
 * @param {string} msg - The message.
 */
const message = function (msg) {
    document.querySelector('.message').textContent = msg;
};

// application
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

app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

app.start();

const colorCamera = new pc.Color(44 / 255, 62 / 255, 80 / 255);
const colorTransparent = new pc.Color(0, 0, 0, 0);

// create camera
const cameraEntity = new pc.Entity();
cameraEntity.addComponent('camera', {
    clearColor: colorCamera
});
app.root.addChild(cameraEntity);

const l = new pc.Entity();
l.addComponent('light', {
    type: 'directional'
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
    cube.setLocalPosition(x, y, z);
    cube.setLocalScale(0.5, 0.5, 0.5);
    app.root.addChild(cube);
};

const controllers = [];

// create controller model
const createController = function (inputSource) {
    const entity = new pc.Entity();

    if (inputSource.hand) {
        // hand input
        // @ts-ignore engine-tsd
        entity.joints = [];

        const material = new pc.StandardMaterial();

        // create box for each hand joint
        for (let i = 0; i < inputSource.hand.joints.length; i++) {
            const joint = inputSource.hand.joints[i];
            const jointEntity = new pc.Entity();
            jointEntity.addComponent('model', {
                type: 'box',
                material: material
            });
            // @ts-ignore engine-tsd
            jointEntity.joint = joint;
            // @ts-ignore engine-tsd
            entity.joints.push(jointEntity);
            entity.addChild(jointEntity);
        }
        // when tracking lost, paint joints to red
        inputSource.hand.on('trackinglost', function () {
            // @ts-ignore engine-tsd
            entity.joints[0].model.material.diffuse.set(1, 0, 0);
            // @ts-ignore engine-tsd
            entity.joints[0].model.material.update();
        });
        // when tracking recovered, paint joints to white
        inputSource.hand.on('tracking', function () {
            // @ts-ignore engine-tsd
            entity.joints[0].model.material.diffuse.set(1, 1, 1);
            // @ts-ignore engine-tsd
            entity.joints[0].model.material.update();
        });
    } else {
        // other inputs
        entity.addComponent('model', {
            type: 'box',
            castShadows: true
        });
        entity.setLocalScale(0.05, 0.05, 0.05);
    }

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
const SIZE = 2;
for (let x = 0; x <= SIZE; x++) {
    for (let y = 0; y <= SIZE; y++) {
        createCube((2 * x - SIZE) * 0.5, 0.25, (2 * y - SIZE) * 0.5);
    }
}

// reusable vector
const vec3A = new pc.Vec3();

if (app.xr.supported) {
    // XR availability
    document
        .querySelector(`.container > .button[data-xr="immersive-ar"]`)
        ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_AR));
    document
        .querySelector(`.container > .button[data-xr="immersive-vr"]`)
        ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_VR));

    // XR availability events
    app.xr.on('available', (type, available) => {
        const element = document.querySelector(`.container > .button[data-xr="${type}"]`);
        element?.classList.toggle('active', available);
    });

    // reset camera color on XR end
    app.xr.on('end', () => {
        cameraEntity.camera.clearColor = colorCamera;
    });

    // button handler
    const onXrButtonClick = function () {
        if (!this.classList.contains('active')) return;

        const type = this.getAttribute('data-xr');

        cameraEntity.camera.clearColor = type === pc.XRTYPE_AR ? colorTransparent : colorCamera;

        app.xr.start(cameraEntity.camera, type, pc.XRSPACE_LOCALFLOOR, {
            callback: function (err) {
                if (err) message(`XR ${type} failed to start: ${err.message}`);
            }
        });
    };

    // button clicks
    const buttons = document.querySelectorAll('.container > .button');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', onXrButtonClick);
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

    if (window.XRHand) {
        message('Choose XR mode, and switch to hand input');
    } else {
        message('WebXR Hands Input is not supported by your platform');
    }

    // update position and rotation for each controller
    app.on('update', function () {
        for (let i = 0; i < controllers.length; i++) {
            const inputSource = controllers[i].inputSource;

            if (inputSource.hand) {
                // hand input source
                controllers[i].enabled = true;
                // update each hand joint
                for (let j = 0; j < controllers[i].joints.length; j++) {
                    const joint = controllers[i].joints[j].joint;
                    const r = joint.radius * 2;
                    controllers[i].joints[j].setLocalScale(r, r, r);
                    controllers[i].joints[j].setPosition(joint.getPosition());
                    controllers[i].joints[j].setRotation(joint.getRotation());
                }
            } else if (inputSource.grip) {
                // grippable input source
                controllers[i].enabled = true;
                controllers[i].setLocalPosition(inputSource.getLocalPosition());
                controllers[i].setLocalRotation(inputSource.getLocalRotation());
            } else {
                // some controllers cannot be gripped
                controllers[i].enabled = false;
            }

            // draw ray
            if (inputSource.targetRayMode === pc.XRTARGETRAY_POINTER) {
                vec3A.copy(inputSource.getDirection()).add(inputSource.getOrigin());
                const color = inputSource.selecting ? pc.Color.GREEN : pc.Color.WHITE;
                app.drawLine(inputSource.getOrigin(), vec3A, color);
            }
        }
    });
} else {
    message('WebXR is not supported');
}

export { app };
