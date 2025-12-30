// @config DESCRIPTION This example demonstrates how to customize the shader handling the instancing of a StandardMaterial.
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/table-mountain-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
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
window.addEventListener('orientationchange', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.exposure = 0.8;
    app.scene.envAtlas = assets.helipad.resource;

    // set up some general scene rendering properties
    app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES
    });
    app.root.addChild(camera);

    // create static vertex buffer containing the instancing data
    const vbFormat = new pc.VertexFormat(app.graphicsDevice, [
        { semantic: pc.SEMANTIC_ATTR12, components: 3, type: pc.TYPE_FLOAT32 }, // position
        { semantic: pc.SEMANTIC_ATTR13, components: 1, type: pc.TYPE_FLOAT32 }  // scale
    ]);

    // store data for individual instances into array, 4 floats each
    const instanceCount = 3000;
    const data = new Float32Array(instanceCount * 4);

    const range = 10;
    for (let i = 0; i < instanceCount; i++) {
        const offset = i * 4;
        data[offset + 0] = Math.random() * range - range * 0.5; // x
        data[offset + 1] = Math.random() * range - range * 0.5; // y
        data[offset + 2] = Math.random() * range - range * 0.5; // z
        data[offset + 3] = 0.1 + Math.random() * 0.1; // scale
    }

    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
        data: data
    });

    // create standard material - this will be used for instanced, but also non-instanced rendering
    const material = new pc.StandardMaterial();
    material.gloss = 0.5;
    material.metalness = 1;
    material.diffuse = new pc.Color(0.7, 0.5, 0.7);
    material.useMetalness = true;

    // set up additional attributes needed for instancing
    material.setAttribute('aInstPosition', pc.SEMANTIC_ATTR12);
    material.setAttribute('aInstScale', pc.SEMANTIC_ATTR13);

    // and a custom instancing shader chunk, which will be used in case the mesh instance has instancing enabled
    material.shaderChunksVersion = '2.8';
    material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('transformInstancingVS', files['transform-instancing.glsl.vert']);
    material.getShaderChunks(pc.SHADERLANGUAGE_WGSL).set('transformInstancingVS', files['transform-instancing.wgsl.vert']);

    material.update();

    // Create an Entity with a sphere and the instancing material
    const instancingEntity = new pc.Entity('InstancingEntity');
    instancingEntity.addComponent('render', {
        material: material,
        type: 'sphere'
    });
    app.root.addChild(instancingEntity);

    // initialize instancing using the vertex buffer on meshInstance of the created mesh instance
    const meshInst = instancingEntity.render.meshInstances[0];
    meshInst.setInstancing(vertexBuffer);

    // add a non-instanced sphere, using the same material. A non-instanced version of the shader
    // is automatically created by the engine
    const sphere = new pc.Entity('sphere');
    sphere.addComponent('render', {
        material: material,
        type: 'sphere'
    });
    sphere.setLocalScale(2, 2, 2);
    app.root.addChild(sphere);

    // An update function executes once per frame
    let time = 0;
    const spherePos = new pc.Vec3();
    app.on('update', (dt) => {
        time += dt;

        // move the large sphere up and down
        spherePos.set(0, Math.sin(time) * 2, 0);
        sphere.setLocalPosition(spherePos);

        // update uniforms of the instancing material
        material.setParameter('uTime', time);
        material.setParameter('uCenter', [spherePos.x, spherePos.y, spherePos.z]);

        // orbit camera around
        camera.setLocalPosition(8 * Math.sin(time * 0.1), 0, 8 * Math.cos(time * 0.1));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };
