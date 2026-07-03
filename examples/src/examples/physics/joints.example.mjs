import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    CollisionComponentSystem,
    Color,
    EVENT_MOUSEDOWN,
    Entity,
    FILLMODE_FILL_WINDOW,
    JOINTTYPE_6DOF,
    JOINTTYPE_BALL,
    JOINTTYPE_FIXED,
    JOINTTYPE_HINGE,
    JOINTTYPE_SLIDER,
    JointComponent,
    JointComponentSystem,
    LightComponentSystem,
    MOTION_FREE,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RigidBodyComponentSystem,
    StandardMaterial,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});
await new Promise(resolve => {
    WasmModule.getInstance('Ammo', () => resolve());
});

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    CollisionComponentSystem,
    RigidBodyComponentSystem,
    JointComponentSystem
];
createOptions.resourceHandlers = [];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

app.systems.rigidbody.gravity.set(0, -9.81, 0);

/**
 * @param {Color} color - The color of the material.
 * @returns {StandardMaterial} The new material.
 */
function createMaterial(color) {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
}

const gray = createMaterial(new Color(0.7, 0.7, 0.7));
const wood = createMaterial(new Color(0.6, 0.4, 0.2));
const blue = createMaterial(new Color(0.3, 0.5, 0.9));
const green = createMaterial(new Color(0.3, 0.8, 0.4));
const red = createMaterial(new Color(1, 0.3, 0.3));

/**
 * Creates a box with render, collision and rigidbody components.
 *
 * @param {string} name - The entity name.
 * @param {Vec3} size - The box dimensions.
 * @param {Vec3} position - The world position.
 * @param {StandardMaterial} material - The render material.
 * @param {string} bodyType - The rigidbody type.
 * @param {number} mass - The body mass.
 * @returns {Entity} The new entity.
 */
function createBox(name, size, position, material, bodyType, mass) {
    const entity = new Entity(name);
    entity.addComponent('render', {
        type: 'box',
        material: material
    });
    entity.setLocalScale(size);
    entity.setPosition(position);
    entity.addComponent('rigidbody', {
        type: bodyType,
        mass: mass
    });
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5)
    });
    app.root.addChild(entity);
    return entity;
}

/**
 * Creates a joint entity at the given pose. The entity is positioned and added to the hierarchy
 * before the joint component is added, so that the joint frames are captured from the final
 * world transform.
 *
 * @param {string} name - The entity name.
 * @param {Vec3} position - The world position of the joint frame.
 * @param {Vec3} eulerAngles - The rotation of the joint frame. The joint's local X axis is its
 * primary axis.
 * @param {object} data - The joint component data.
 * @returns {Entity} The new joint entity.
 */
function createJoint(name, position, eulerAngles, data) {
    const entity = new Entity(name);
    entity.setPosition(position);
    entity.setEulerAngles(eulerAngles);
    app.root.addChild(entity);
    entity.addComponent('joint', data);
    return entity;
}

// ***********    Floor, light and camera   *******************

const floor = createBox('floor', new Vec3(26, 1, 10), new Vec3(0, 0, 0), gray, 'static', 0);
floor.rigidbody.restitution = 0.4;

const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    castShadows: true,
    shadowBias: 0.2,
    shadowDistance: 40,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.5, 0.5, 0.8),
    farClip: 100
});
app.root.addChild(camera);
camera.translate(0, 6, 18);
camera.lookAt(0, 2, 0);

// ***********    Hinge joint: a door with rotation limits   *******************

const doorFrame = createBox('door-frame', new Vec3(0.25, 3, 0.25), new Vec3(-10.5, 2, 0), wood, 'static', 0);
const door = createBox('door', new Vec3(1.6, 2.4, 0.12), new Vec3(-9.55, 1.95, 0), green, 'dynamic', 20);

// The hinge sits at the door frame and its X axis points up - the door swings about it,
// limited to 110 degrees of opening
createJoint('door-hinge', new Vec3(-10.35, 1.95, 0), new Vec3(0, 0, 90), {
    type: JOINTTYPE_HINGE,
    entityA: door,
    entityB: doorFrame,
    enableLimits: true,
    limits: new Vec2(0, 110)
});

// ***********    Hinge joint: a motor driven windmill   *******************

const pole = createBox('pole', new Vec3(0.25, 4, 0.25), new Vec3(-5.5, 2, 0), wood, 'static', 0);
const rotor = createBox('rotor', new Vec3(3.5, 0.35, 0.15), new Vec3(-5.5, 4, 0.3), blue, 'dynamic', 10);

// The hinge axis points at the camera (world Z) and the motor spins the rotor at a constant
// angular speed
createJoint('windmill-hinge', new Vec3(-5.5, 4, 0.3), new Vec3(0, -90, 0), {
    type: JOINTTYPE_HINGE,
    entityA: rotor,
    entityB: pole,
    motorSpeed: 90,
    maxMotorForce: 100
});

// ***********    Ball joints: a hanging chain with asymmetric swing limits   *******************

const links = [];
for (let i = 0; i < 6; i++) {
    const link = createBox(`link-${i}`, new Vec3(0.18, 0.5, 0.18), new Vec3(-2, 5.25 - i * 0.5, 0), blue, 'dynamic', 2);
    links.push(link);

    // Each ball joint sits at the top of its link with its X axis pointing down the chain and
    // its Y axis along world X - the chain can swing widely left and right (swingLimitY) but
    // barely forwards and backwards (swingLimitZ)
    createJoint(`chain-joint-${i}`, new Vec3(-2, 5.5 - i * 0.5, 0), new Vec3(0, 0, -90), {
        type: JOINTTYPE_BALL,
        entityA: link,
        entityB: i > 0 ? links[i - 1] : null,
        enableLimits: true,
        swingLimitY: 60,
        swingLimitZ: 5,
        twistLimit: 10
    });
}

// Start the chain swinging
links[5].rigidbody.applyImpulse(8, 0, 8);

// ***********    Slider joint: a platform patrolling a rail   *******************

// The rail is a visual guide only
const rail = new Entity('rail');
rail.addComponent('render', {
    type: 'box',
    material: wood
});
rail.setLocalScale(4.5, 0.08, 0.5);
rail.setPosition(1.5, 0.62, 0);
app.root.addChild(rail);

const platform = createBox('platform', new Vec3(0.8, 0.25, 0.6), new Vec3(1.5, 0.85, 0), green, 'dynamic', 10);

// The slider is pinned to the world (entityB is null) - the platform can only translate along
// the joint's X axis, driven back and forth by the motor (active because maxMotorForce > 0)
const sliderJoint = createJoint('slider', new Vec3(1.5, 0.85, 0), new Vec3(0, 0, 0), {
    type: JOINTTYPE_SLIDER,
    entityA: platform,
    enableLimits: true,
    limits: new Vec2(-2, 2),
    motorSpeed: 1.5,
    maxMotorForce: 400
});

// ***********    6dof joint: a crate bobbing on a spring   *******************

// The joint entity must be unscaled, so the visual marker lives on a scaled child
const anchor = new Entity('anchor');
anchor.setPosition(5, 4, 0);
app.root.addChild(anchor);

const anchorVisual = new Entity('anchor-visual');
anchorVisual.addComponent('render', {
    type: 'box',
    material: gray
});
anchorVisual.setLocalScale(0.2, 0.2, 0.2);
anchor.addChild(anchorVisual);

const crate = createBox('crate', new Vec3(0.7, 0.7, 0.7), new Vec3(5, 4, 0), wood, 'dynamic', 5);
crate.rigidbody.linearDamping = 0.2;

// The anchor entity itself holds the joint - the crate hangs below it on a sprung, vertical
// degree of freedom (a spring acts on any axis with a stiffness greater than 0). 6dof offsets
// measure entityB (here the world anchor) relative to entityA (the crate), so a positive
// equilibrium rests the crate below the anchor
anchor.addComponent('joint', {
    type: JOINTTYPE_6DOF,
    entityA: crate,
    linearMotionY: MOTION_FREE,
    linearStiffness: new Vec3(0, 80, 0),
    linearEquilibrium: new Vec3(0, 1.2, 0)
});

// ***********    Fixed joints: a breakable tower   *******************

const towerBoxes = [];
for (let i = 0; i < 4; i++) {
    towerBoxes.push(
        createBox(`tower-${i}`, new Vec3(0.7, 0.7, 0.7), new Vec3(8.5, 0.85 + i * 0.7, 0), green, 'dynamic', 8)
    );
}
for (let i = 0; i < 3; i++) {
    const lower = towerBoxes[i];
    const upper = towerBoxes[i + 1];

    const weld = createJoint(`weld-${i}`, new Vec3(8.5, 1.2 + i * 0.7, 0), new Vec3(0, 0, 0), {
        type: JOINTTYPE_FIXED,
        entityA: upper,
        entityB: lower,
        breakImpulse: 60
    });

    // Tint the separated boxes red when the weld breaks
    weld.joint.on(JointComponent.EVENT_BREAK, () => {
        lower.render.meshInstances[0].material = red;
        upper.render.meshInstances[0].material = red;
        console.log(`${weld.name} broke`);
    });
}

// ***********    Click to shoot balls   *******************

app.mouse.on(EVENT_MOUSEDOWN, event => {
    const ball = new Entity('ball');
    ball.addComponent('render', {
        type: 'sphere',
        material: red
    });
    ball.setLocalScale(0.5, 0.5, 0.5);
    ball.setPosition(camera.getPosition());
    ball.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 15
    });
    ball.addComponent('collision', {
        type: 'sphere',
        radius: 0.25
    });
    app.root.addChild(ball);

    const target = camera.camera.screenToWorld(event.x, event.y, 10);
    const direction = target.sub(camera.getPosition()).normalize();
    ball.rigidbody.linearVelocity = direction.mulScalar(35);
});

// ***********    Update   *******************

// Reverse the slider motor at each end of the rail to patrol back and forth
let patrolTimer = 0;
app.on('update', dt => {
    patrolTimer += dt;
    if (patrolTimer > 3) {
        patrolTimer = 0;
        sliderJoint.joint.motorSpeed = -sliderJoint.joint.motorSpeed;
    }
});
