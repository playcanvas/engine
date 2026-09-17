// @config
//
// A GPU flock simulated with transform feedback in separate-buffer mode, where each captured varying
// is written into its own vertex buffer. That lets every buffer take the role it actually needs:
// position and velocity are read and written each step, per-agent constants are read only and never
// copied, and a fourth buffer is written only, holding just the world position and heading the
// instanced cone draw consumes. The render pass never binds the simulation buffers at all. Cone
// colour comes from the heading, so the value stored in the instancing buffer is visible.
//
// @flag WEBGPU_DISABLED

import {
    AppBase,
    AppOptions,
    BUFFER_GPUDYNAMIC,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_ATTR0,
    SEMANTIC_ATTR1,
    SEMANTIC_ATTR12,
    SEMANTIC_ATTR2,
    SHADERLANGUAGE_GLSL,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_ACES,
    TRANSFORM_FEEDBACK_SEPARATE,
    TYPE_FLOAT32,
    TransformFeedback,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

import * as shaderChunksGLSL from './shader-chunks.glsl.mjs';

import flockSimVert from './flock-sim.vert';
import transformInstancingGlslVert from './transform-instancing.glsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];

const app = new AppBase(canvas);
app.init(createOptions);

app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.scene.ambientLight = new Color(0.12, 0.13, 0.18);

// Create main camera, with orbit controls
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.02, 0.02, 0.04),
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.setPosition(0, 15, 36);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = Vec3.ZERO;

const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.9, 0.75),
    intensity: 2
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const agentCount = 4000;
const areaSize = 12;

// Transform feedback is a WebGL2 only feature
if (device.isWebGL2) {
    // A format per stream. The semantic is what binds a buffer to a shader attribute - the
    // simulation shader's attributes are assigned ATTR0, ATTR1 and ATTR2 in declaration order.
    const streamFormat = (semantic) =>
        new VertexFormat(device, [{ semantic: semantic, components: 4, type: TYPE_FLOAT32 }]);

    const positionData = new Float32Array(agentCount * 4);
    const velocityData = new Float32Array(agentCount * 4);
    const constantData = new Float32Array(agentCount * 4);

    for (let i = 0; i < agentCount; i++) {
        const offset = i * 4;
        const angle = Math.random() * Math.PI * 2;
        const radius = areaSize * (0.3 + Math.random() * 0.6);
        const seed = Math.random();

        positionData[offset] = Math.cos(angle) * radius;
        positionData[offset + 1] = (Math.random() - 0.5) * 6;
        positionData[offset + 2] = Math.sin(angle) * radius;

        // a tangential kick, so the flock starts swirling rather than settling
        velocityData[offset] = -Math.sin(angle) * 4;
        velocityData[offset + 2] = Math.cos(angle) * 4;

        constantData[offset] = seed;
        constantData[offset + 1] = 4 + seed * 5; // maximum speed
        constantData[offset + 2] = 1.5 + seed * 3; // wander strength
    }

    const gpuDynamic = (data) => ({ usage: BUFFER_GPUDYNAMIC, data: data });

    const positions = new VertexBuffer(device, streamFormat(SEMANTIC_ATTR0), agentCount, gpuDynamic(positionData));
    const velocities = new VertexBuffer(device, streamFormat(SEMANTIC_ATTR1), agentCount, gpuDynamic(velocityData));

    // Per-agent constants. Read every step and never written, so they need no second buffer and are
    // never copied through transform feedback.
    const constants = new VertexBuffer(device, streamFormat(SEMANTIC_ATTR2), agentCount, gpuDynamic(constantData));

    // The instancing stream. Written every step and never read back by the simulation, so it holds
    // exactly the position and heading the render pass needs and nothing else. Note it is filled
    // entirely by the GPU, but still needs initial data so its storage gets allocated first.
    const instances = new VertexBuffer(
        device,
        streamFormat(SEMANTIC_ATTR12),
        agentCount,
        gpuDynamic(new Float32Array(agentCount * 4))
    );

    // The second half of each ping-pong pair. Transform feedback writes into these, and they are
    // then swapped with the buffers above, so those always hold the freshest data.
    const positionsOut = new VertexBuffer(device, positions.format, agentCount, gpuDynamic(positionData));
    const velocitiesOut = new VertexBuffer(device, velocities.format, agentCount, gpuDynamic(velocityData));

    // Each buffer states its own role
    const tf = new TransformFeedback([
        { input: positions, output: positionsOut }, // read and written, swapped each step
        { input: velocities, output: velocitiesOut }, // read and written, swapped each step
        { input: constants }, // read only, never modified
        { output: instances } // written only, for the render pass
    ]);

    // The varyings are listed in the order the output buffers appear above
    const shader = TransformFeedback.createShader(
        device,
        flockSimVert,
        'flockSeparateFeedback',
        ['out_position', 'out_velocity', 'out_instance'],
        TRANSFORM_FEEDBACK_SEPARATE
    );

    // Standard material rendering instanced cones, with a custom instancing chunk that builds each
    // instance matrix from the position and heading in the instancing buffer
    const material = new StandardMaterial();
    material.gloss = 0.6;
    material.metalness = 0.7;
    material.useMetalness = true;
    material.setAttribute('aInstPosition', SEMANTIC_ATTR12);
    material.shaderChunksVersion = '2.8';

    const chunks = material.getShaderChunks(SHADERLANGUAGE_GLSL);
    chunks.set('transformInstancingVS', transformInstancingGlslVert);

    // take the per-instance colour written by the instancing chunk and use it as the albedo
    chunks.set('litUserDeclarationPS', shaderChunksGLSL.litUserDeclarationPS);
    chunks.set('diffusePS', shaderChunksGLSL.diffusePS);

    material.update();

    const flock = new Entity('Flock');
    flock.addComponent('render', {
        material: material,
        type: 'cone'
    });
    app.root.addChild(flock);

    // Drive the instanced draw from the transform feedback output. This reference never changes -
    // the instancing buffer is written in place every step.
    flock.render.meshInstances[0].setInstancing(instances);

    // Resolve the simulation and rendering shader parameters
    const deltaTimeUniform = device.scope.resolve('uDeltaTime');
    const timeUniform = device.scope.resolve('uTime');
    const areaSizeUniform = device.scope.resolve('uAreaSize');
    device.scope.resolve('uConeSize').setValue(0.09);

    let time = 0;
    app.on('update', (dt) => {
        time += dt;

        // run one simulation step, filling both output buffers in a single pass
        deltaTimeUniform.setValue(Math.min(dt, 0.05));
        timeUniform.setValue(time);
        areaSizeUniform.setValue(areaSize);
        tf.process(shader);
    });
}
