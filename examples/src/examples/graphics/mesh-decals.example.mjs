import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    heart: new pc.Asset('heart', 'texture', { url: rootPath + '/static/assets/textures/heart.png' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.LightComponentSystem, pc.CameraComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

    // create material for the plane
    const planeMaterial = new pc.StandardMaterial();
    planeMaterial.gloss = 0.6;
    planeMaterial.metalness = 0.5;
    planeMaterial.useMetalness = true;
    planeMaterial.gloss = 0.6;
    planeMaterial.update();

    // create plane primitive
    const primitive = new pc.Entity();
    primitive.addComponent('render', {
        type: 'plane',
        material: planeMaterial
    });

    // set scale and add it to scene
    primitive.setLocalScale(new pc.Vec3(20, 20, 20));
    app.root.addChild(primitive);

    // Create an Entity with a omni light component
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'omni',
        color: new pc.Color(0.2, 0.2, 0.2),
        intensity: 2.5,
        range: 30,
        castShadows: true,
        shadowBias: 0.1,
        normalOffsetBias: 0.2
    });
    light.translate(0, 8, 0);
    app.root.addChild(light);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2)
    });

    // Add the camera to the hierarchy
    app.root.addChild(camera);

    // Create bouncing ball model and add it to hierarchy
    const ball = new pc.Entity();
    ball.addComponent('render', {
        type: 'sphere'
    });
    app.root.addChild(ball);

    // Allocate space for decals. Each decal is a quad with 4 vertices
    const numDecals = 500;
    const numDecalVertices = 4 * numDecals;

    // Allocate storage for vertex positions, vertex stores x, y and z
    const positions = new Float32Array(3 * numDecalVertices);

    // Allocate storage for colors, each vertex stores r, g, b and a
    const colors = new Uint8ClampedArray(4 * numDecalVertices);

    // Allocate storage for uvs, each vertex stores u and v. And fill them up to display whole texture
    /** @type {number[]} */
    const uvs = [];
    for (let i = 0; i < numDecals; i++) uvs.push(0, 0, 0, 1, 1, 1, 1, 0);

    // Allocate and generate indices. Each quad is representing using 2 triangles, and uses 4 vertices
    const quadTriangles = [0, 1, 2, 2, 3, 0];
    const indices = new Uint16Array(6 * numDecals);
    for (let i = 0; i < numDecals; i++) {
        indices[6 * i + 0] = 4 * i + quadTriangles[0];
        indices[6 * i + 1] = 4 * i + quadTriangles[1];
        indices[6 * i + 2] = 4 * i + quadTriangles[2];
        indices[6 * i + 3] = 4 * i + quadTriangles[3];
        indices[6 * i + 4] = 4 * i + quadTriangles[4];
        indices[6 * i + 5] = 4 * i + quadTriangles[5];
    }

    /**
     * Helper function to generate a decal with index i at position
     * pos. It fills up information for all 4 vertices of a quad.
     * @param {number} i - The decal index.
     * @param {pc.Vec3} pos - The position.
     */
    function createDecal(i, pos) {
        // random size and rotation angle
        const size = 0.5 + Math.random();
        let angle = Math.random() * Math.PI;

        // random color
        const r = Math.random() * 255;
        const g = Math.random() * 255;
        const b = Math.random() * 255;

        for (let j = 0; j < 4; j++) {
            colors[i * 16 + j * 4 + 0] = r;
            colors[i * 16 + j * 4 + 1] = g;
            colors[i * 16 + j * 4 + 2] = b;
            colors[i * 16 + j * 4 + 3] = 0; // alpha is not used by shader
        }

        // vertex positions to form a square quad with random rotation and size
        positions[12 * i + 0] = pos.x + size * Math.sin(angle);
        positions[12 * i + 1] = 0;
        positions[12 * i + 2] = pos.z + size * Math.cos(angle);
        angle += Math.PI * 0.5;

        positions[12 * i + 3] = pos.x + size * Math.sin(angle);
        positions[12 * i + 4] = 0;
        positions[12 * i + 5] = pos.z + size * Math.cos(angle);
        angle += Math.PI * 0.5;

        positions[12 * i + 6] = pos.x + size * Math.sin(angle);
        positions[12 * i + 7] = 0;
        positions[12 * i + 8] = pos.z + size * Math.cos(angle);
        angle += Math.PI * 0.5;

        positions[12 * i + 9] = pos.x + size * Math.sin(angle);
        positions[12 * i + 10] = 0;
        positions[12 * i + 11] = pos.z + size * Math.cos(angle);
        angle += Math.PI * 0.5;
    }

    /**
     * Helper function to update required vertex streams.
     * @param {pc.Mesh} mesh - The mesh.
     * @param {boolean} updatePositions - Update positions.
     * @param {boolean} updateColors - Update colors.
     * @param {boolean} [initAll] - Set UV's and indices.
     */
    function updateMesh(mesh, updatePositions, updateColors, initAll) {
        // update positions when needed
        if (updatePositions) mesh.setPositions(positions);

        // update colors when needed
        if (updateColors) mesh.setColors32(colors);

        // update indices and uvs only one time, as they never change
        if (initAll) {
            mesh.setIndices(indices);
            mesh.setUvs(0, uvs);
        }

        mesh.update(pc.PRIMITIVE_TRIANGLES);
    }

    // Create a mesh with dynamic vertex buffer and static index buffer
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.clear(true, false);
    updateMesh(mesh, true, true, true);

    // create material
    const material = new pc.StandardMaterial();
    material.useLighting = false; // turn off lighting - we use emissive texture only. Also, lighting needs normal maps which we don't generate
    material.diffuse = new pc.Color(0, 0, 0);
    material.emissiveVertexColor = true;
    material.blendType = pc.BLEND_ADDITIVEALPHA; // additive alpha blend
    material.depthWrite = false; // optimization - no need to write to depth buffer, as decals are part of the ground plane
    material.emissiveMap = assets.heart.resource;
    material.opacityMap = assets.heart.resource;
    material.depthBias = -0.1; // depth biases to avoid z-fighting with ground plane
    material.slopeDepthBias = -0.1;
    material.update();

    // Create the mesh instance
    const meshInstance = new pc.MeshInstance(mesh, material);

    // Create Entity with a render component to render the mesh instance
    const entity = new pc.Entity();
    entity.addComponent('render', {
        type: 'asset',
        meshInstances: [meshInstance],
        castShadows: false
    });
    app.root.addChild(entity);

    // Set an update function on the app's update event
    let time = 0;
    let decalIndex = 0;
    app.on('update', (/** @type {number} */ dt) => {
        const previousTime = time;
        time += dt;

        // Bounce the ball around in a circle with changing radius
        const radius = Math.abs(Math.sin(time * 0.55) * 9);
        const previousElevation = 2 * Math.cos(previousTime * 7);
        const elevation = 2 * Math.cos(time * 7);
        ball.setLocalPosition(new pc.Vec3(radius * Math.sin(time), 0.5 + Math.abs(elevation), radius * Math.cos(time)));

        // When ball crossed the ground plane
        let positionsUpdated = false;
        let colorsUpdated = false;
        if ((previousElevation < 0 && elevation >= 0) || (elevation < 0 && previousElevation >= 0)) {
            // create new decal at next index, and roll the index around if out of range
            createDecal(decalIndex, ball.getLocalPosition());
            decalIndex++;
            if (decalIndex >= numDecals) decalIndex = 0;

            // both position and color streams were updated
            positionsUpdated = true;
            colorsUpdated = true;
        }

        // fade out all vertex colors once a second
        if (Math.round(time) !== Math.round(previousTime)) {
            for (let i = 0; i < colors.length; i++) colors[i] -= 2;

            // colors were updated
            colorsUpdated = true;
        }

        // update mesh with the streams that were updated
        updateMesh(mesh, positionsUpdated, colorsUpdated);

        // orbit camera around
        camera.setLocalPosition(20 * Math.sin(time * 0.3), 10, 20 * Math.cos(time * 0.3));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };
