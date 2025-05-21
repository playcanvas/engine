// @config DESCRIPTION <div style='color: black;'>This example shows how to override shader chunks of StandardMaterial.</div>
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    tree: new pc.Asset('cube', 'container', { url: `${rootPath}/static/assets/models/low-poly-tree.glb` })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

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

    app.scene.ambientLight = new pc.Color(0.4, 0.2, 0.0);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES,
        clearColor: new pc.Color(0.95, 0.95, 0.95)
    });
    app.root.addChild(camera);

    // add a shadow casting directional light
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.06,
        shadowDistance: 35
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(45, 30, 0);

    // number of tree instances to render
    const instanceCount = 1000;

    // store matrices for individual instances into array
    const matrices = new Float32Array(instanceCount * 16);
    let matrixIndex = 0;

    const pos = new pc.Vec3();
    const rot = new pc.Quat();
    const scl = new pc.Vec3();
    const matrix = new pc.Mat4();

    for (let i = 0; i < instanceCount; i++) {

        // random points in the circle
        const maxRadius = 20;
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.sqrt(Math.random() * (maxRadius ** 2));

        // generate random positions / scales and rotations
        pos.set(radius * Math.cos(angle), 0, radius * Math.sin(angle));
        scl.set(0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.2);
        pos.y = -1.5 + scl.y * 4.5;
        matrix.setTRS(pos, rot, scl);

        // copy matrix elements into array of floats
        for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
    }

    // create static vertex buffer containing the matrices
    const vbFormat = pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
        data: matrices
    });

    // create a forest by setting up the tree model for instancing
    const forest = assets.tree.resource.instantiateRenderEntity();
    app.root.addChild(forest);
    const meshInstance = forest.findComponent('render').meshInstances[0];
    meshInstance.setInstancing(vertexBuffer);

    // ------ Shader chunks to override StandardMaterial default behavior ------

    // a fragment chunk to add few uniforms
    const litUserDeclarationPS = /* glsl */ `
        uniform float myTime;
        uniform vec2 myFogParams;
    `;

    // override existing diffuse fragment chunk to simply blend between two colors based on time
    const diffusePS = /* glsl */ `
    void getAlbedo() {
        float blend = 0.5 + 0.5 * sin(myTime * 0.5);
        vec3 green = vec3(0.2, 1.0, 0.0);
        vec3 orange = vec3(1.0, 0.2, 0.0);
        dAlbedo = mix(green, orange, blend);
    }
    `;

    // a fragment chunk with runs at the end of the main function of the shader, to apply ground fog
    const litUserMainEndPS = /* glsl */ `
        vec3 fogColor = vec3(1.0, 1.0, 1.0);
        float fogStart = myFogParams.x;
        float fogEnd = myFogParams.y;

        // Compute fog amount based on height
        float fogFactor = clamp((vPositionW.y - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
        gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, fogFactor);
    `;

    // a vertex shader chunk to customize the code generating vertex position in local (object) space.
    // The vertex position is adjusted to sway in the wind based. Note that some parts of the original
    // chunk were removed, and only parts relevant to instancing were kept, as that's what is needed here.
    const transformCoreVS = /* glsl */ `

        uniform float myTime;   // add time uniform to vertex shader

        // these are existing attributes and uniforms
        attribute vec4 vertex_position;
        uniform mat4 matrix_viewProjection;
        uniform mat4 matrix_model;
        uniform mat3 matrix_normal;

        #if defined(INSTANCING)
            #include "transformInstancingVS"
        #endif

        // provide a replacement function here to do the actual work, instead of simply returning the vertexPosition
        vec3 getLocalPosition(vec3 vertexPosition) {
            // Extract the position (translation) from the model matrix - this is the position of the instance of the tree
            vec3 treePosition = getModelMatrix()[3].xyz;

            // and use it to generate a random seed for the sway, so all trees are not synchronized
            float randomSeed = treePosition.x * 0.1 + treePosition.z * 0.5;

            // Height-based sway factor (0 at base, 1 at top). Note that the pivot point of the tree is not at the base,
            // so compensate for that.
            float heightFromBase = vertexPosition.y + 4.5;
            float maxSwayHeight = 9.0;
            float swayFactor = clamp(heightFromBase / maxSwayHeight, 0.0, 1.0);

            // Parameters - could be exposed as uniforms
            float swayStrength = 0.3;
            float swaySpeed = 2.0;

            // sway the tree
            vec3 localPos = vertexPosition;
            float bendOffset = sin(myTime * swaySpeed + randomSeed);
            localPos.x += bendOffset * swayFactor * heightFromBase * swayStrength;

            return localPos;
        }
    `;

    // ------ End of shader chunks ------

    // apply all these chunks to the tree material
    const treeChunksGLSL = meshInstance.material.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
    treeChunksGLSL.set('diffusePS', diffusePS);
    treeChunksGLSL.set('litUserMainEndPS', litUserMainEndPS);
    treeChunksGLSL.set('litUserDeclarationPS', litUserDeclarationPS);
    treeChunksGLSL.set('transformCoreVS', transformCoreVS);
    meshInstance.material.shaderChunksVersion = '2.8';

    // create a ground material - all chunks apart from swaying in the wind, so fog and color blending
    const groundMaterial = new pc.StandardMaterial();
    const groundChunksGLSL = groundMaterial.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
    groundChunksGLSL.set('diffusePS', diffusePS);
    groundChunksGLSL.set('litUserMainEndPS', litUserMainEndPS);
    groundChunksGLSL.set('litUserDeclarationPS', litUserDeclarationPS);
    groundMaterial.shaderChunksVersion = '2.8';

    const ground = new pc.Entity('Ground');
    ground.addComponent('render', {
        type: 'cylinder',
        material: groundMaterial
    });
    ground.setLocalScale(50, 1, 50);
    ground.setLocalPosition(0, -2, 0);
    app.root.addChild(ground);

    // update things every frame
    let time = 0;
    app.on('update', (dt) => {
        time += dt;

        // update uniforms once per frame. Note that this needs to use unique uniform names, to make sure
        // nothing overrides those. Alternatively, you could 'setParameter' on the materials.
        app.graphicsDevice.scope.resolve('myTime').setValue(time);
        app.graphicsDevice.scope.resolve('myFogParams').setValue([-2, 2]);

        // orbit camera around
        camera.setLocalPosition(18 * Math.sin(time * 0.05), 10, 18 * Math.cos(time * 0.05));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };
