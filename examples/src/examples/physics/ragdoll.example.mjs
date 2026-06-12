import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.JointComponentSystem
];
createOptions.resourceHandlers = [];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

app.systems.rigidbody.gravity.set(0, -9.81, 0);

// ragdolls are chains of small fast-moving bodies - a finer physics timestep prevents limbs
// tunnelling through the floor on impact
app.systems.rigidbody.fixedTimeStep = 1 / 120;

/**
 * @param {pc.Color} color - The color of the material.
 * @returns {pc.StandardMaterial} The new material.
 */
function createMaterial(color) {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
}

const gray = createMaterial(new pc.Color(0.7, 0.7, 0.7));
const wood = createMaterial(new pc.Color(0.6, 0.4, 0.2));
const blue = createMaterial(new pc.Color(0.3, 0.5, 0.9));
const skin = createMaterial(new pc.Color(0.9, 0.7, 0.55));
const red = createMaterial(new pc.Color(1, 0.3, 0.3));

// ***********    Floor, obstacle, light and camera   *******************

const floor = new pc.Entity('floor');
floor.addComponent('render', { type: 'box', material: gray });
floor.setLocalScale(24, 1, 12);
floor.addComponent('rigidbody', { type: 'static' });
floor.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(12, 0.5, 6) });
app.root.addChild(floor);

// something for a ragdoll to drape over
const obstacle = new pc.Entity('obstacle');
obstacle.addComponent('render', { type: 'box', material: wood });
obstacle.setLocalScale(1.4, 0.7, 0.9);
obstacle.setPosition(0, 0.85, 0);
obstacle.addComponent('rigidbody', { type: 'static' });
obstacle.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(0.7, 0.35, 0.45) });
app.root.addChild(obstacle);

const light = new pc.Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 1, 1),
    castShadows: true,
    shadowBias: 0.2,
    shadowDistance: 40,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.5, 0.5, 0.8),
    farClip: 100
});
app.root.addChild(camera);
camera.translate(0, 3.5, 10);
camera.lookAt(0, 1, 0);

// ***********    Ragdoll template   *******************

/**
 * Creates a ragdoll body part with render, collision and rigidbody components, parented to the
 * ragdoll root.
 *
 * @param {pc.Entity} root - The ragdoll root entity.
 * @param {string} name - The part name.
 * @param {pc.Vec3} size - The part dimensions.
 * @param {pc.Vec3} position - The position relative to the ragdoll root.
 * @param {number} mass - The part mass.
 * @param {pc.StandardMaterial} material - The render material.
 * @returns {pc.Entity} The new part.
 */
function createPart(root, name, size, position, mass, material) {
    const part = new pc.Entity(name);
    part.addComponent('render', { type: 'box', material: material });
    part.setLocalScale(size);
    part.setLocalPosition(position);
    part.addComponent('rigidbody', {
        type: 'dynamic',
        mass: mass,
        linearDamping: 0.05,
        angularDamping: 0.1
    });
    part.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5)
    });
    root.addChild(part);
    return part;
}

/**
 * Creates a joint entity at the given pose relative to the ragdoll root. The joint's local X
 * axis is its primary axis: the twist axis of ball joints and the rotation axis of hinges.
 *
 * @param {pc.Entity} root - The ragdoll root entity.
 * @param {string} name - The joint name.
 * @param {pc.Vec3} position - The position of the joint frame relative to the ragdoll root.
 * @param {pc.Vec3} eulerAngles - The rotation of the joint frame.
 * @param {object} data - The joint component data.
 */
function createJoint(root, name, position, eulerAngles, data) {
    const joint = new pc.Entity(name);
    joint.setLocalPosition(position);
    joint.setLocalEulerAngles(eulerAngles);
    root.addChild(joint);
    joint.addComponent('joint', data);
}

/**
 * Builds a T-posed humanoid ragdoll, facing Z, with its feet at the root origin. Ball joints
 * with swing and twist limits form the hips, spine, neck and shoulders; limited hinges form the
 * knees and elbows.
 *
 * @returns {pc.Entity} The disabled ragdoll template.
 */
function createRagdollTemplate() {
    const root = new pc.Entity('ragdoll');

    const pelvis = createPart(root, 'pelvis', new pc.Vec3(0.34, 0.2, 0.2), new pc.Vec3(0, 0.9, 0), 8, blue);
    const torso = createPart(root, 'torso', new pc.Vec3(0.36, 0.46, 0.22), new pc.Vec3(0, 1.26, 0), 10, blue);
    const head = createPart(root, 'head', new pc.Vec3(0.22, 0.24, 0.24), new pc.Vec3(0, 1.66, 0), 3, skin);

    // a ball joint spine with tight limits and a freer ball joint neck - their X (twist) axes
    // point up
    createJoint(root, 'spine', new pc.Vec3(0, 1.02, 0), new pc.Vec3(0, 0, 90), {
        type: pc.JOINTTYPE_BALL,
        entityA: torso,
        entityB: pelvis,
        enableLimits: true,
        swingLimitY: 20,
        swingLimitZ: 20,
        twistLimit: 15
    });
    createJoint(root, 'neck', new pc.Vec3(0, 1.52, 0), new pc.Vec3(0, 0, 90), {
        type: pc.JOINTTYPE_BALL,
        entityA: head,
        entityB: torso,
        enableLimits: true,
        swingLimitY: 35,
        swingLimitZ: 35,
        twistLimit: 60
    });

    for (const side of [-1, 1]) {
        const prefix = side < 0 ? 'l-' : 'r-';

        // legs hang down - the hip twist axis points down the thigh, swinging further forwards
        // and backwards (Z) than sideways (Y)
        const thigh = createPart(root, `${prefix}thigh`, new pc.Vec3(0.13, 0.38, 0.13), new pc.Vec3(side * 0.11, 0.6, 0), 4, blue);
        const shin = createPart(root, `${prefix}shin`, new pc.Vec3(0.12, 0.38, 0.12), new pc.Vec3(side * 0.11, 0.2, 0), 2.5, skin);

        createJoint(root, `${prefix}hip`, new pc.Vec3(side * 0.11, 0.8, 0), new pc.Vec3(0, 0, -90), {
            type: pc.JOINTTYPE_BALL,
            entityA: thigh,
            entityB: pelvis,
            enableLimits: true,
            swingLimitY: 30,
            swingLimitZ: 70,
            twistLimit: 20
        });

        // the knee hinge axis points along world X, so positive rotation folds the shin
        // backwards
        createJoint(root, `${prefix}knee`, new pc.Vec3(side * 0.11, 0.4, 0), new pc.Vec3(0, 0, 0), {
            type: pc.JOINTTYPE_HINGE,
            entityA: shin,
            entityB: thigh,
            enableLimits: true,
            limits: new pc.Vec2(0, 140)
        });

        // arms extend sideways in a T-pose - the shoulder twist axis points along the arm
        const upperArm = createPart(root, `${prefix}upper-arm`, new pc.Vec3(0.28, 0.12, 0.12), new pc.Vec3(side * 0.36, 1.4, 0), 1.5, skin);
        const forearm = createPart(root, `${prefix}forearm`, new pc.Vec3(0.28, 0.11, 0.11), new pc.Vec3(side * 0.66, 1.4, 0), 1, skin);

        createJoint(root, `${prefix}shoulder`, new pc.Vec3(side * 0.21, 1.4, 0), new pc.Vec3(0, 0, side < 0 ? 180 : 0), {
            type: pc.JOINTTYPE_BALL,
            entityA: upperArm,
            entityB: torso,
            enableLimits: true,
            swingLimitY: 80,
            swingLimitZ: 80,
            twistLimit: 30
        });

        // the elbow hinge axis points up - the limits are mirrored so that each arm folds
        // towards the torso
        createJoint(root, `${prefix}elbow`, new pc.Vec3(side * 0.51, 1.4, 0), new pc.Vec3(0, 0, 90), {
            type: pc.JOINTTYPE_HINGE,
            entityA: forearm,
            entityB: upperArm,
            enableLimits: true,
            limits: side < 0 ? new pc.Vec2(0, 140) : new pc.Vec2(-140, 0)
        });
    }

    // the template is never simulated - spawned ragdolls are clones of it, with their joints
    // remapped to the cloned body parts
    root.enabled = false;
    return root;
}

const template = createRagdollTemplate();

/**
 * Spawns a ragdoll by cloning the template. The clone is positioned before it is added to the
 * hierarchy and enabled, so that its bodies and joint frames are created at their final pose.
 *
 * @param {number} x - The world X position.
 * @param {number} y - The world Y position of the ragdoll's feet.
 * @param {number} yaw - The rotation about the Y axis, in degrees.
 * @returns {pc.Entity} The spawned ragdoll.
 */
function spawnRagdoll(x, y, yaw) {
    const ragdoll = template.clone();
    ragdoll.setPosition(x, y, 0);
    ragdoll.setEulerAngles(0, yaw, 0);
    app.root.addChild(ragdoll);
    ragdoll.enabled = true;

    // tumble as it falls
    const pelvis = ragdoll.findByName('pelvis');
    pelvis.rigidbody.angularVelocity = new pc.Vec3(Math.random() * 3 - 1.5, Math.random() * 2 - 1, Math.random() * 3 - 1.5);

    return ragdoll;
}

spawnRagdoll(-2.2, 1.3, 35);
spawnRagdoll(0, 2, 0);
spawnRagdoll(2.2, 1.5, -40);

// ***********    Drag bodies with the pointer, or shoot balls   *******************

// the grab anchor is a kinematic body that collides with nothing - the grabbed part is jointed
// to it and follows as the anchor is moved under the pointer
const anchor = new pc.Entity('grab-anchor');
anchor.addComponent('render', { type: 'sphere', material: red });
anchor.setLocalScale(0.15, 0.15, 0.15);
anchor.addComponent('rigidbody', { type: 'kinematic' });
anchor.addComponent('collision', { type: 'sphere', radius: 0.05 });
anchor.rigidbody.mask = pc.BODYMASK_NONE;
anchor.enabled = false;
app.root.addChild(anchor);

// the grab is a ball joint, so the grabbed part swings freely about the grip point
const grabJoint = new pc.Entity('grab-joint');
app.root.addChild(grabJoint);
grabJoint.addComponent('joint', { type: pc.JOINTTYPE_BALL });

let grabbed = null;
let grabDistance = 0;

/**
 * Attempts to grab the dynamic body under the pointer.
 *
 * @param {number} x - The pointer X coordinate.
 * @param {number} y - The pointer Y coordinate.
 * @returns {boolean} True if a body was grabbed.
 */
function startGrab(x, y) {
    const start = camera.getPosition();
    const end = camera.camera.screenToWorld(x, y, camera.camera.farClip);
    const hit = app.systems.rigidbody.raycastFirst(start, end);
    if (!hit || hit.entity.rigidbody.type !== pc.BODYTYPE_DYNAMIC) {
        return false;
    }

    grabbed = hit.entity;
    grabDistance = hit.point.distance(start);

    // place the anchor and the joint frame at the grip point before attaching, so the joint
    // frames are captured there - the grabbed body is assigned last, creating the constraint
    // once it is fully configured
    anchor.enabled = true;
    anchor.rigidbody.teleport(hit.point);
    grabJoint.setPosition(hit.point);
    grabJoint.joint.entityB = anchor;
    grabJoint.joint.entityA = grabbed;

    return true;
}

/**
 * Moves the grab anchor under the pointer, at the distance the body was grabbed at.
 *
 * @param {number} x - The pointer X coordinate.
 * @param {number} y - The pointer Y coordinate.
 */
function moveGrab(x, y) {
    if (!grabbed) {
        return;
    }

    const start = camera.getPosition();
    const direction = camera.camera.screenToWorld(x, y, camera.camera.farClip).sub(start).normalize();
    anchor.rigidbody.teleport(direction.mulScalar(grabDistance).add(start));
    grabbed.rigidbody.activate();
}

/**
 * Releases the grabbed body.
 */
function endGrab() {
    if (!grabbed) {
        return;
    }

    grabbed = null;
    grabJoint.joint.entityA = null;
    grabJoint.joint.entityB = null;
    anchor.enabled = false;
}

/**
 * Shoots a ball towards the pointer.
 *
 * @param {number} x - The pointer X coordinate.
 * @param {number} y - The pointer Y coordinate.
 */
function shootBall(x, y) {
    const ball = new pc.Entity('ball');
    ball.addComponent('render', {
        type: 'sphere',
        material: red
    });
    ball.setLocalScale(0.4, 0.4, 0.4);
    ball.setPosition(camera.getPosition());
    ball.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 10
    });
    ball.addComponent('collision', {
        type: 'sphere',
        radius: 0.2
    });
    app.root.addChild(ball);

    const target = camera.camera.screenToWorld(x, y, 10);
    const direction = target.sub(camera.getPosition()).normalize();
    ball.rigidbody.linearVelocity = direction.mulScalar(30);
}

app.mouse.on(pc.EVENT_MOUSEDOWN, (event) => {
    if (!startGrab(event.x, event.y)) {
        shootBall(event.x, event.y);
    }
});
app.mouse.on(pc.EVENT_MOUSEMOVE, (event) => {
    moveGrab(event.x, event.y);
});
app.mouse.on(pc.EVENT_MOUSEUP, () => {
    endGrab();
});

app.touch.on(pc.EVENT_TOUCHSTART, (event) => {
    const touch = event.touches[0];
    if (touch && !startGrab(touch.x, touch.y)) {
        shootBall(touch.x, touch.y);
    }
    // prevent the browser generating a synthetic mousedown for this touch
    event.event.preventDefault();
});
app.touch.on(pc.EVENT_TOUCHMOVE, (event) => {
    const touch = event.touches[0];
    if (touch) {
        moveGrab(touch.x, touch.y);
    }
    event.event.preventDefault();
});
app.touch.on(pc.EVENT_TOUCHEND, () => {
    endGrab();
});
app.touch.on(pc.EVENT_TOUCHCANCEL, () => {
    endGrab();
});
