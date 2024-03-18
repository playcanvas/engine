import * as pc from 'playcanvas';
import { deviceType, rootPath } from '@examples/utils';
import files from '@examples/files';

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}

const assets = {
    texture: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' }),
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
const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {

    // set up some general scene rendering properties
    app.scene.toneMapping = pc.TONEMAP_ACES;

    // setup skydome
    app.scene.skyboxMip = 1;
    app.scene.skyboxIntensity = 1.7;
    app.scene.envAtlas = assets.helipad.resource;

    // create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9)
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 3);

    // create directional light entity
    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 0, 0);

    // create a storage texture, that the compute shader will write to. Make it the same dimensions
    // as the loaded input texture
    const storageTexture = new pc.Texture(app.graphicsDevice, {
        name: 'outputTexture',
        width: assets.texture.resource.width,
        height: assets.texture.resource.height,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,

        // this is a storage texture, allowing compute shader to write to it
        storage: true
    });

    // a compute shader that will tint the input texture and write the result to the storage texture
    const shader = new pc.Shader(device, {
        name: 'ComputeShader',
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,
        cshader: files['compute-shader.wgsl']
    });

    // bind group for the compute shader - this needs to match the bindings in the shader
    const buffers = [];
    const textures = [
        new pc.BindTextureFormat('inTexture', pc.SHADERSTAGE_COMPUTE)
    ];
    const storageTextures = [
        new pc.BindStorageTextureFormat('outTexture', pc.PIXELFORMAT_RGBA8, pc.TEXTUREDIMENSION_2D)
    ];
    shader.impl.computeBindGroupFormat = new pc.BindGroupFormat(device, buffers, textures, storageTextures, {
        compute: true
    });

    // create an instance of the compute shader, and set the input and output textures
    const compute = new pc.Compute(device, shader);
    compute.setParameter('outTexture', storageTexture);
    compute.setParameter('inTexture', assets.texture.resource);

    // add a box in the scene, using the storage texture as a material
    const material = new pc.StandardMaterial();
    material.diffuseMap = storageTexture;
    material.update();

    // create box entity
    const box = new pc.Entity('cube');
    box.addComponent('render', {
        type: 'box',
        material: material
    });
    app.root.addChild(box);

    app.on('update', function (/** @type {number} */ dt) {

        box.rotate(10 * dt, 20 * dt, 30 * dt);

        // run the compute shader each frame (even though it generates the same output)
        compute.dispatch(storageTexture.width, storageTexture.height);

        // debug render the generated texture
        app.drawTexture(0.6, -0.7, 0.6, 0.3, storageTexture);
    });

});

export { app };
