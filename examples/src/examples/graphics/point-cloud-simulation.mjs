import * as pc from 'playcanvas';

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, glslangPath, twgslPath, files }) {
    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);

    // render to low resolution to make particles more visible on WebGPU, as it doesn't support point
    // size and those are very small otherwise. This is not a proper solution, and only a temporary
    // workaround specifically for this example use case.
    if (device.isWebGPU) {
        device.maxPixelRatio = 0.2;
    }

    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);
    app.start();

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent("camera", {
        clearColor: new pc.Color(0, 0, 0)
    });

    // Add entity into scene hierarchy
    app.root.addChild(camera);

    // allocate two buffers to store positions of particles
    const maxNumPoints = 100000;
    let visiblePoints = 10000;
    const positions = new Float32Array(3 * maxNumPoints);
    const oldPositions = new Float32Array(3 * maxNumPoints);

    // generate random positions and old positions within small cube (delta between them represents velocity)
    for (let i = 0; i < 3 * maxNumPoints; i++) {
        positions[i] = Math.random() * 2 - 1;
        oldPositions[i] = positions[i] + Math.random() * 0.04 - 0.01;
    }

    /**
     * helper function to update vertex of the mesh
     * @param {pc.Mesh} mesh - The mesh.
     */
    function updateMesh(mesh) {
        // Set current positions on mesh - this reallocates vertex buffer if more space is needed to test it.
        // For best performance, we could preallocate enough space using mesh.Clear.
        // Also turn off bounding box generation, as we set up large box manually
        mesh.setPositions(positions, 3, visiblePoints);
        mesh.update(pc.PRIMITIVE_POINTS, false);
    }

    // Create a mesh with dynamic vertex buffer (index buffer is not needed)
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.clear(true);
    updateMesh(mesh);

    // set large bounding box so we don't need to update it each frame
    mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(15, 15, 15));

    // Create the shader from the vertex and fragment shaders
    const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
        aPosition: pc.SEMANTIC_POSITION,
        aUv0: pc.SEMANTIC_TEXCOORD0
    });

    // Create a new material with the new shader and additive alpha blending
    const material = new pc.Material();
    material.shader = shader;
    material.blendType = pc.BLEND_ADDITIVEALPHA;
    material.depthWrite = false;

    // Create the mesh instance
    const meshInstance = new pc.MeshInstance(mesh, material);

    // Create Entity to render the mesh instances using a render component
    const entity = new pc.Entity();
    entity.addComponent("render", {
        type: 'asset',
        meshInstances: [meshInstance],
        material: material,
        castShadows: false
    });
    app.root.addChild(entity);

    // Set an update function on the app's update event
    let time = 0, previousTime;
    app.on("update", function (dt) {
        previousTime = time;
        time += dt;

        // update particle positions using simple Verlet integration, and keep them inside a sphere boundary
        let dist;
        const pos = new pc.Vec3();
        const old = new pc.Vec3();
        const delta = new pc.Vec3();
        const next = new pc.Vec3();
        for (let i = 0; i < maxNumPoints; i++) {

            // read positions from buffers
            old.set(oldPositions[i * 3], oldPositions[i * 3 + 1], oldPositions[i * 3 + 2]);
            pos.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);

            // verlet integration to move them
            delta.sub2(pos, old);
            next.add2(pos, delta);

            // boundary collision to keep them inside a sphere. If outside, simply move them in opposite direction
            dist = next.length();
            if (dist > 15)
                next.copy(old);

            // write out changed positions
            positions[i * 3] = next.x;
            positions[i * 3 + 1] = next.y;
            positions[i * 3 + 2] = next.z;

            oldPositions[i * 3] = pos.x;
            oldPositions[i * 3 + 1] = pos.y;
            oldPositions[i * 3 + 2] = pos.z;
        }

        // once a second change how many points are visible
        if (Math.round(time) !== Math.round(previousTime))
            visiblePoints = Math.floor(50000 + Math.random() * maxNumPoints - 50000);

        // update mesh vertices
        updateMesh(mesh);

        // Rotate the camera around
        const cameraTime = time * 0.2;
        const cameraPos = new pc.Vec3(20 * Math.sin(cameraTime), 10, 20 * Math.cos(cameraTime));
        camera.setLocalPosition(cameraPos);
        camera.lookAt(pc.Vec3.ZERO);
    });
    return app;
}

export class PointCloudSimulationExample {
    static CATEGORY = 'Graphics';
    static FILES = {
        'shader.vert': /* glsl */`
// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;

// position of the camera
uniform vec3 view_position;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry
    mat4 modelViewProj = matrix_viewProjection * matrix_model;
    gl_Position = modelViewProj * aPosition;

    // vertex in world space
    vec4 vertexWorld = matrix_model * aPosition;

    // point sprite size depends on its distance to camera
    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
    #ifndef WEBGPU
        float dist = 25.0 - length(vertexWorld.xyz - view_position);
        gl_PointSize = clamp(dist * 2.0 - 1.0, 1.0, 15.0);
    #endif

    // color depends on position of particle
    outColor = vec4(vertexWorld.y * 0.1, 0.1, vertexWorld.z * 0.1, 1.0);
}`,
        'shader.frag': /* glsl */`
precision mediump float;
varying vec4 outColor;

void main(void)
{
    // color supplied by vertex shader
    gl_FragColor = outColor;

    // Using gl_PointCoord in WebGPU fails to compile with: "unknown SPIR-V builtin: 16"
    #ifndef WEBGPU
        // make point round instead of square - make pixels outside of the circle black, using provided gl_PointCoord
        vec2 dist = gl_PointCoord.xy - vec2(0.5, 0.5);
        gl_FragColor.a = 1.0 - smoothstep(0.4, 0.5, sqrt(dot(dist, dist)));
    #endif
}`
    };

    static example = example;
}
