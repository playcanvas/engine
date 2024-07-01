import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// initialize basis
pc.basisInitialize({
    glueUrl: rootPath + '/static/lib/basis/basis.wasm.js',
    wasmUrl: rootPath + '/static/lib/basis/basis.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/basis/basis.js'
});

const assets = {
    color: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.basis' }, { srgb: true }),
    gloss: new pc.Asset('gloss', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-gloss.basis' }),
    normal: new pc.Asset(
        'normal',
        'texture',
        { url: rootPath + '/static/assets/textures/seaside-rocks01-normal.basis' },
        { type: pc.TEXTURETYPE_SWIZZLEGGGR }
    ),
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

    // Set skybox
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxMip = 1;
    app.scene.skyboxIntensity = 1.4;
    app.scene.envAtlas = assets.helipad.resource;

    // Create directional light
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional'
    });
    light.setLocalEulerAngles(45, 0, 45);

    // Construct material
    const material = new pc.StandardMaterial();
    material.useMetalness = true;
    material.diffuse = new pc.Color(0.3, 0.3, 0.3);
    material.gloss = 0.8;
    material.metalness = 0.7;
    material.diffuseMap = assets.color.resource;
    material.normalMap = assets.normal.resource;
    material.glossMap = assets.gloss.resource;
    material.diffuseMapTiling.set(7, 7);
    material.normalMapTiling.set(7, 7);
    material.glossMapTiling.set(7, 7);
    material.update();

    // Create a torus shape
    const torus = pc.Mesh.fromGeometry(
        app.graphicsDevice,
        new pc.TorusGeometry({
            tubeRadius: 0.2,
            ringRadius: 0.3,
            segments: 50,
            sides: 40
        })
    );
    const shape = new pc.Entity();
    shape.addComponent('render', {
        material: material,
        meshInstances: [new pc.MeshInstance(torus, material)]
    });
    shape.setPosition(0, 0, 0);
    shape.setLocalScale(2, 2, 2);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });

    // Adjust the camera position
    camera.translate(0, 0, 4);

    // Add the new Entities to the hierarchy
    app.root.addChild(light);
    app.root.addChild(shape);
    app.root.addChild(camera);

    // Set an update function on the app's update event
    let angle = 0;
    app.on('update', function (dt) {
        angle = (angle + dt * 10) % 360;

        // Rotate the boxes
        shape.setEulerAngles(angle, angle * 2, angle * 4);
    });
});

export { app };
