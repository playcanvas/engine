import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
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

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.exposure = 0.3;
    app.scene.envAtlas = assets.helipad.resource;

    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {});
    app.root.addChild(camera);

    // Move the camera back to see the cubes
    camera.translate(0, 0, 10);

    // number of instances to render
    const instanceCount = 1000;

    // create static vertex buffer containing the instancing data
    const vbFormat = new pc.VertexFormat(app.graphicsDevice, [
        { semantic: pc.SEMANTIC_ATTR12, components: 3, type: pc.TYPE_FLOAT32 }, // position
        { semantic: pc.SEMANTIC_ATTR13, components: 1, type: pc.TYPE_FLOAT32 }  // scale
    ]);

    // store data for individual instances into array, 4 floats each
    const data = new Float32Array(instanceCount * 4);

    for (let i = 0; i < instanceCount; i++) {
        const offset = i * 4;
        data[offset + 0] = Math.random() * 5 - 5 * 0.5; // x
        data[offset + 1] = Math.random() * 5 - 5 * 0.5; // y
        data[offset + 2] = Math.random() * 5 - 5 * 0.5; // z
        data[offset + 3] = 0.1 + Math.random() * 0.1; // scale
    }

    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
        data: data
    });

    // create standard material
    const material = new pc.StandardMaterial();
    material.gloss = 0.6;
    material.metalness = 0.7;
    material.useMetalness = true;


    material.setAttribute('aInstPosition', pc.SEMANTIC_ATTR12);
    material.setAttribute('aInstScale', pc.SEMANTIC_ATTR13);



    material.chunks.transformInstancingVS = `

        attribute vec3 aInstPosition;
        attribute float aInstScale;

        mat4 getModelMatrix() {
            return mat4(
                vec4(aInstScale, 0.0, 0.0, 0.0),
                vec4(0.0, aInstScale, 0.0, 0.0),
                vec4(0.0, 0.0, aInstScale, 0.0),
                vec4(aInstPosition, 1.0)
            );
        }


    `;


    material.update();

    // Create an Entity with a cylinder render component and the instancing material
    const cylinder = new pc.Entity('InstancingEntity');
    cylinder.addComponent('render', {
        material: material,
        type: 'cylinder'
    });
    app.root.addChild(cylinder);

    // initialize instancing using the vertex buffer on meshInstance of the created cylinder
    const cylinderMeshInst = cylinder.render.meshInstances[0];
    cylinderMeshInst.setInstancing(vertexBuffer);





    // add a non-instanced sphere, using the same material. A non-instanced version of the shader
    // is automatically created by the engine
    const sphere = new pc.Entity('sphere');
    sphere.addComponent('render', {
        material: material,
        type: 'sphere'
    });
    sphere.setLocalScale(2, 2, 2);
    app.root.addChild(sphere);




    // Set an update function on the app's update event
    let angle = 0;
    app.on('update', function (dt) {
        // orbit camera around
        angle += dt * 0.2;
        camera.setLocalPosition(8 * Math.sin(angle), 0, 8 * Math.cos(angle));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };
