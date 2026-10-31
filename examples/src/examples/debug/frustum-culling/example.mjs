// @config
//
// Visualize frustum culling. A second camera sweeps the scene while its view volume is drawn with
// WireRenderer, and every object's bounding box is colored by whether the frustum contains it.
// Arrows show each object's direction of travel.

import {
    ASPECT_MANUAL,
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    Frustum,
    LightComponentSystem,
    Mat4,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    Vec3,
    WireRenderer,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

data.set('settings', {
    applyCulling: true,
    showFrustum: true,
    showBounds: true,
    showVelocity: true,
    throughObserver: false
});

// Renderers used for the debug overlay. A second set of properties is simply a second instance,
// and instances sharing a layer and depth test mode submit into the same batch.
const wire = new WireRenderer(app);
const visibleWire = new WireRenderer(app);
visibleWire.color = new Color(0.2, 1, 0.4);
const culledWire = new WireRenderer(app);
culledWire.color = new Color(1, 0.25, 0.25);

// The region the objects bounce around inside
const HALF_EXTENT = 12;
const REGION_MIN = new Vec3(-HALF_EXTENT, -HALF_EXTENT, -HALF_EXTENT);
const REGION_MAX = new Vec3(HALF_EXTENT, HALF_EXTENT, HALF_EXTENT);

const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    intensity: 1.5
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

// A cloud of drifting objects, each keeping its own velocity
const objects = [];
for (let i = 0; i < 40; i++) {
    const material = new StandardMaterial();
    material.diffuse = new Color(0.4 + Math.random() * 0.5, 0.4 + Math.random() * 0.5, 0.5);
    material.gloss = 0.4;
    material.metalness = 0.2;
    material.useMetalness = true;
    material.update();

    const entity = new Entity(`object${i}`);
    entity.addComponent('render', {
        type: i % 3 === 0 ? 'box' : 'sphere',
        material: material
    });
    entity.setLocalPosition(
        (Math.random() * 2 - 1) * HALF_EXTENT,
        (Math.random() * 2 - 1) * HALF_EXTENT,
        (Math.random() * 2 - 1) * HALF_EXTENT
    );
    entity.setLocalScale(1.6, 1.6, 1.6);
    app.root.addChild(entity);

    objects.push({
        entity: entity,
        velocity: new Vec3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
            .normalize()
            .mulScalar(2 + Math.random() * 4)
    });
}

// The camera the scene is viewed from
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.05, 0.06, 0.08),
    farClip: 200
});
camera.setLocalPosition(45, 28, 45);
camera.lookAt(Vec3.ZERO);
app.root.addChild(camera);

// The camera whose frustum is visualized and culled against. Its aspect ratio is set manually so
// the frustum is well defined even while the camera is not rendering.
const observer = new Entity('observer');
observer.addComponent('camera', {
    fov: 45,
    nearClip: 2,
    farClip: 26,
    aspectRatioMode: ASPECT_MANUAL,
    aspectRatio: 1.6
});
observer.camera.enabled = false;
app.root.addChild(observer);

const ORBIT_RADIUS = 26;
const ORBIT_HEIGHT = 8;

// The path the observer travels, drawn once as a closed loop
const orbitPath = [];
for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    orbitPath.push(new Vec3(Math.sin(angle) * ORBIT_RADIUS, ORBIT_HEIGHT, Math.cos(angle) * ORBIT_RADIUS));
}

const viewProjection = new Mat4();
const viewMatrix = new Mat4();
const frustum = new Frustum();

// scratch values, so the update loop allocates nothing
const tip = new Vec3();
const step = new Vec3();
const position = new Vec3();
const FRUSTUM_COLOR = new Color(1, 0.85, 0.2);
const REGION_COLOR = new Color(0.35, 0.35, 0.4);

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // Drift the objects, reflecting them off the walls of the region
    for (const object of objects) {
        const velocity = object.velocity;
        position.copy(object.entity.getLocalPosition()).add(step.copy(velocity).mulScalar(dt));

        if (position.x < REGION_MIN.x || position.x > REGION_MAX.x) velocity.x *= -1;
        if (position.y < REGION_MIN.y || position.y > REGION_MAX.y) velocity.y *= -1;
        if (position.z < REGION_MIN.z || position.z > REGION_MAX.z) velocity.z *= -1;

        object.entity.setLocalPosition(position);
    }

    // Sweep the observer around the scene, always looking at the middle of the region
    observer.setLocalPosition(Math.sin(time * 0.3) * ORBIT_RADIUS, ORBIT_HEIGHT, Math.cos(time * 0.3) * ORBIT_RADIUS);
    observer.lookAt(Vec3.ZERO);

    // Build the frustum the objects are tested against. The view matrix is derived from the
    // entity transform, because CameraComponent#viewMatrix is only refreshed for a camera that
    // is actually being rendered, and the observer usually is not.
    viewMatrix.copy(observer.getWorldTransform()).invert();
    viewProjection.mul2(observer.camera.projectionMatrix, viewMatrix);
    frustum.setFromMat4(viewProjection);

    for (const object of objects) {
        const meshInstance = object.entity.render.meshInstances[0];
        const inside = frustum.containsAabb(meshInstance.aabb);

        // Culling an object is simply hiding it, which is what the renderer does internally
        meshInstance.visible = data.get('settings.applyCulling') ? inside : true;

        if (data.get('settings.showBounds')) {
            (inside ? visibleWire : culledWire).box(meshInstance.aabb);
        }

        if (data.get('settings.showVelocity')) {
            // The arrow shows the direction only, so a fast object does not draw a longer arrow
            const origin = object.entity.getPosition();
            tip.copy(object.velocity).normalize().mulScalar(3).add(origin);
            (inside ? visibleWire : culledWire).arrow(origin, tip);
        }
    }

    if (data.get('settings.showFrustum')) {
        wire.color = FRUSTUM_COLOR;
        wire.frustum(observer.camera);
        wire.axes(observer.getWorldTransform(), 3);
    }

    // The region the objects are confined to, and the path the observer travels
    wire.color = REGION_COLOR;
    wire.boxMinMax(REGION_MIN, REGION_MAX);
    wire.loop(orbitPath);

    // Viewing the scene through the observer proves the culling is correct - nothing pops in
    camera.camera.enabled = !data.get('settings.throughObserver');
    observer.camera.enabled = data.get('settings.throughObserver');
});
