import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Morph,
    MorphInstance,
    MorphTarget,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SphereGeometry,
    StandardMaterial,
    Vec3,
    calculateNormals,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];

const app = new AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically
// Change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Create an entity with a directional light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional'
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);

/**
 * Helper function to return the shortest distance from point [x, y, z] to a
 * plane defined by [a, b, c] normal.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} a - The plane normal's x coordinate.
 * @param {number} b - The plane normal's y coordinate.
 * @param {number} c - The plane normal's z coordinate.
 * @returns {number} The shortest distance.
 */
const shortestDistance = (x, y, z, a, b, c) => {
    const d = Math.abs(a * x + b * y + c * z);
    const e = Math.sqrt(a * a + b * b + c * c);
    return d / e;
};

/**
 * Helper function that creates a morph target from original positions, normals
 * and indices, and a plane normal [nx, ny, nz].
 * @param {number[]} positions - The positions.
 * @param {number[]} normals - The normals.
 * @param {number[]} indices - The indices.
 * @param {number} nx - The plane normal's x coordinate.
 * @param {number} ny - The plane normal's y coordinate.
 * @param {number} nz - The plane normal's z coordinate.
 * @returns {MorphTarget} The morph target.
 */
const createMorphTarget = (positions, normals, indices, nx, ny, nz) => {
    // Modify vertices to separate array
    const modifiedPositions = new Float32Array(positions.length);
    /** @type {number} */
    let dist;
    /** @type {number} */
    let i;
    /** @type {number} */
    let displacement;
    const limit = 0.2;
    for (i = 0; i < positions.length; i += 3) {
        // Distance of the point to the specified plane
        dist = shortestDistance(positions[i], positions[i + 1], positions[i + 2], nx, ny, nz);

        // Modify distance to displacement amount - displace nearby points more than distant points
        displacement = math.smoothstep(0, limit, dist);
        displacement = 1 - displacement;

        // Generate new position by extruding vertex along normal by displacement
        modifiedPositions[i] = positions[i] + normals[i] * displacement;
        modifiedPositions[i + 1] = positions[i + 1] + normals[i + 1] * displacement;
        modifiedPositions[i + 2] = positions[i + 2] + normals[i + 2] * displacement;
    }

    // Generate normals based on modified positions and indices
    // @ts-ignore engine-tsd
    const modifiedNormals = new Float32Array(calculateNormals(modifiedPositions, indices));

    // Generate delta positions and normals - as morph targets store delta between base position / normal and modified position / normal
    for (i = 0; i < modifiedNormals.length; i++) {
        modifiedPositions[i] -= positions[i];
        modifiedNormals[i] -= normals[i];
    }

    // Create a morph target
    // @ts-ignore engine-tsd
    return new MorphTarget({
        deltaPositions: modifiedPositions,
        deltaNormals: modifiedNormals
    });
};

/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @returns {MorphInstance} The morph instance.
 */
const createMorphInstance = (x, y, z) => {
    // Create the base mesh - a sphere, with higher amount of vertices / triangles
    const mesh = Mesh.fromGeometry(app.graphicsDevice, new SphereGeometry({ latitudeBands: 200, longitudeBands: 200 }));

    // Obtain base mesh vertex / index data
    /** @type {number[]} */
    const srcPositions = [];
    /** @type {number[]} */
    const srcNormals = [];
    /** @type {number[]} */
    const indices = [];
    mesh.getPositions(srcPositions);
    mesh.getNormals(srcNormals);
    mesh.getIndices(indices);

    // Build 3 targets by expanding a part of sphere along 3 planes, specified by the normal
    const targets = [];
    targets.push(createMorphTarget(srcPositions, srcNormals, indices, 1, 0, 0));
    targets.push(createMorphTarget(srcPositions, srcNormals, indices, 0, 1, 0));
    targets.push(createMorphTarget(srcPositions, srcNormals, indices, 0, 0, 1));

    // Create a morph using these 3 targets
    mesh.morph = new Morph(targets, app.graphicsDevice);

    // Create the mesh instance
    const material = new StandardMaterial();
    const meshInstance = new MeshInstance(mesh, material);

    // Add morph instance - this is where currently set weights are stored
    const morphInstance = new MorphInstance(mesh.morph);
    meshInstance.morphInstance = morphInstance;

    // Create Entity and add it to the scene
    const entity = new Entity();
    entity.setLocalPosition(x, y, z);
    app.root.addChild(entity);

    // Add a render component with meshInstance
    entity.addComponent('render', {
        material: material,
        meshInstances: [meshInstance]
    });

    return morphInstance;
};

// Create 3 morph instances
/** @type {MorphInstance[]} */
const morphInstances = [];
for (let k = 0; k < 3; k++) {
    morphInstances.push(createMorphInstance(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3));
}

// Update function called once per frame
let time = 0;
app.on('update', (dt) => {
    time += dt;

    for (let m = 0; m < morphInstances.length; m++) {
        // Modify weights of all 3 morph targets along some sin curve with different frequency
        morphInstances[m].setWeight(0, Math.abs(Math.sin(time + m)));
        morphInstances[m].setWeight(1, Math.abs(Math.sin(time * 0.3 + m)));
        morphInstances[m].setWeight(2, Math.abs(Math.sin(time * 0.7 + m)));
    }

    // Orbit camera around
    camera.setLocalPosition(16 * Math.sin(time * 0.2), 4, 16 * Math.cos(time * 0.2));
    camera.lookAt(Vec3.ZERO);
});
