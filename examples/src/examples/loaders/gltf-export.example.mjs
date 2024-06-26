import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// add AR button to download the glb file
const appInner = /** @type {HTMLElement} */ (document.getElementById('appInner'));
const div = document.createElement('div');
div.style.cssText = 'width:100%; position:absolute; top:10px';
div.innerHTML = `<div style="text-align: center;">
    <a id="ar-link" rel="ar" download="scene.glb">
        <img src="${rootPath}/static/assets/textures/transparent.png" id="button" width="200"/>
    </a>    
</div>`;
appInner.appendChild(div);

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: rootPath + '/static/lib/draco/draco.wasm.js',
    wasmUrl: rootPath + '/static/lib/draco/draco.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/draco/draco.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve(true));
});

// initialize basis to allow to load compressed textures
pc.basisInitialize({
    glueUrl: rootPath + '/static/lib/basis/basis.wasm.js',
    wasmUrl: rootPath + '/static/lib/basis/basis.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/basis/basis.js'
});

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    bench: new pc.Asset('bench', 'container', { url: rootPath + '/static/assets/models/bench_wooden_01.glb' }),
    model: new pc.Asset('model', 'container', { url: rootPath + '/static/assets/models/bitmoji.glb' }),
    board: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/chess-board.glb' }),
    boombox: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/boom-box.glb' }),
    color: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.basis' })
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

    // get the instance of the bench and set up with render component
    const entity1 = assets.bench.resource.instantiateRenderEntity();
    entity1.setLocalPosition(0, 0, -1.5);
    app.root.addChild(entity1);

    // the character
    const entity2 = assets.model.resource.instantiateRenderEntity();
    app.root.addChild(entity2);

    // chess board
    const entity3 = assets.board.resource.instantiateRenderEntity();
    entity3.setLocalScale(0.01, 0.01, 0.01);
    app.root.addChild(entity3);

    const entity4 = assets.boombox.resource.instantiateRenderEntity();
    entity4.setLocalPosition(0, 0.5, -3);
    entity4.setLocalScale(100, 100, 100);
    app.root.addChild(entity4);

    // a render component with a sphere and cone primitives
    const material = new pc.StandardMaterial();
    material.diffuse = pc.Color.RED;
    material.update();

    const entity = new pc.Entity('TwoMeshInstances');
    entity.addComponent('render', {
        type: 'asset',
        meshInstances: [
            new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry()), material),
            new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice, new pc.ConeGeometry()), material)
        ]
    });
    app.root.addChild(entity);
    entity.setLocalPosition(0, 1.5, -1.5);

    // mesh with a basic material
    const basicMaterial = new pc.BasicMaterial();
    basicMaterial.color.set(1.6, 2.7, 1.9);
    basicMaterial.colorMap = assets.color.resource;

    const capsule = new pc.Entity('capsule');
    capsule.addComponent('render', {
        material: basicMaterial,
        type: 'capsule'
    });
    capsule.setLocalPosition(0.5, 2.0, -0.5);
    app.root.addChild(capsule);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.1, 0.1),
        farClip: 100
    });
    camera.translate(-3, 1, 2);
    camera.lookAt(0, 0.5, 0);
    app.root.addChild(camera);

    // set skybox
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxMip = 1;
    app.scene.exposure = 1.5;

    // a link element, created in the html part of the examples.
    const link = document.getElementById('ar-link');

    // export the whole scene into a glb format
    const options = {
        maxTextureSize: 1024
    };

    new pc.GltfExporter()
        .build(app.root, options)
        .then((arrayBuffer) => {
            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });

            // @ts-ignore
            link.href = URL.createObjectURL(blob);
        })
        .catch(console.error);

    // when clicking on the download UI button, trigger the download
    data.on('download', function () {
        link.click();
    });
});

export { app };
