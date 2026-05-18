// @config DESCRIPTION <div style='color: white;'>This example demonstrates scrolling cloud shadows using a shader chunk override on StandardMaterial.</div>
import { data } from 'examples/observer';
import { deviceType, rootPath, localImport } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    tree: new pc.Asset('tree', 'container', { url: `${rootPath}/static/assets/models/low-poly-tree.glb` }),
    clouds: new pc.Asset('clouds', 'texture', { url: `${rootPath}/static/assets/textures/clouds.jpg` }),
    envAtlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/morning-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const shaderLanguage = device.isWebGPU ? pc.SHADERLANGUAGE_WGSL : pc.SHADERLANGUAGE_GLSL;
const shaderChunkFile = device.isWebGPU ? 'shader-chunks.wgsl.mjs' : 'shader-chunks.glsl.mjs';
const shaderChunks = await localImport(shaderChunkFile);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.envAtlas = assets.envAtlas.resource;
    app.scene.skyboxMip = 1;
    app.scene.exposure = 0.4;

    // camera
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES,
        clearColor: new pc.Color(0.55, 0.7, 0.9)
    });
    app.root.addChild(camera);

    // directional light with shadows
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

    // instanced trees
    const instanceCount = 1000;
    const matrices = new Float32Array(instanceCount * 16);
    let matrixIndex = 0;

    const pos = new pc.Vec3();
    const rot = new pc.Quat();
    const scl = new pc.Vec3();
    const matrix = new pc.Mat4();

    for (let i = 0; i < instanceCount; i++) {
        const maxRadius = 20;
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.sqrt(Math.random() * (maxRadius ** 2));

        pos.set(radius * Math.cos(angle), 0, radius * Math.sin(angle));
        scl.set(0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.2);
        pos.y = -1.5 + scl.y * 4.5;
        matrix.setTRS(pos, rot, scl);

        for (let m = 0; m < 16; m++) matrices[matrixIndex++] = matrix.data[m];
    }

    const vbFormat = pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
        data: matrices
    });

    const forest = assets.tree.resource.instantiateRenderEntity();
    app.root.addChild(forest);
    const meshInstance = forest.findComponent('render').meshInstances[0];
    meshInstance.setInstancing(vertexBuffer);

    // apply cloud shadow chunks to tree material
    const treeMaterial = meshInstance.material;
    treeMaterial.getShaderChunks(shaderLanguage).add(shaderChunks);
    treeMaterial.shaderChunksVersion = '2.8';

    // ground plane with cloud shadow chunks
    const groundMaterial = new pc.StandardMaterial();
    groundMaterial.getShaderChunks(shaderLanguage).add(shaderChunks);
    groundMaterial.shaderChunksVersion = '2.8';

    const ground = new pc.Entity('Ground');
    ground.addComponent('render', {
        type: 'cylinder',
        material: groundMaterial
    });
    ground.setLocalScale(50, 1, 50);
    ground.setLocalPosition(0, -2, 0);
    app.root.addChild(ground);

    // ensure the cloud texture wraps so the scrolling tiles seamlessly
    const cloudTexture = assets.clouds.resource;
    cloudTexture.addressU = pc.ADDRESS_REPEAT;
    cloudTexture.addressV = pc.ADDRESS_REPEAT;

    // set default control values
    data.set('data', {
        speed: 0.03,
        direction: 30,
        intensity: 0.9,
        scale: 0.01
    });

    const scope = app.graphicsDevice.scope;
    let time = 0;
    let offsetX = 0;
    let offsetY = 0;

    app.on('update', (dt) => {
        time += dt;

        const speed = data.get('data.speed');
        const directionDeg = data.get('data.direction');
        const intensity = data.get('data.intensity');
        const scale = data.get('data.scale');

        // scroll direction from angle
        const dirRad = directionDeg * Math.PI / 180;
        offsetX += Math.cos(dirRad) * speed * dt;
        offsetY += Math.sin(dirRad) * speed * dt;

        // set cloud shadow uniforms globally - all materials with the chunk receive them
        scope.resolve('cloudShadowTexture').setValue(cloudTexture);
        scope.resolve('cloudShadowOffset').setValue([offsetX, offsetY]);
        scope.resolve('cloudShadowScale').setValue(scale);
        scope.resolve('cloudShadowIntensity').setValue(intensity);

        // orbit camera
        camera.setLocalPosition(18 * Math.sin(time * 0.05), 10, 18 * Math.cos(time * 0.05));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };
