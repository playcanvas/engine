// @config WEBGL_DISABLED
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';
import files from 'examples/files';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    texture: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' }),
    solid: new pc.Asset('solid', 'container', { url: rootPath + '/static/assets/models/icosahedron.glb' }),
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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
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
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // setup skydome
    app.scene.skyboxMip = 1;
    app.scene.skyboxIntensity = 3;
    app.scene.envAtlas = assets.helipad.resource;

    // create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9)
    });
    app.root.addChild(camera);
    camera.setPosition(0.6, 0, 5);

    // create directional light entity
    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 0, 0);

    // a helper script that rotates the entity
    const Rotator = pc.createScript('rotator');
    Rotator.prototype.update = function (/** @type {number} */ dt) {
        this.entity.rotate(10 * dt, 20 * dt, 30 * dt);
    };

    // a compute shader that will tint the input texture and write the result to the storage texture
    const shader = device.supportsCompute ?
        new pc.Shader(device, {
            name: 'ComputeShader',
            shaderLanguage: pc.SHADERLANGUAGE_WGSL,
            cshader: files['compute-shader.wgsl'],

            computeUniformBufferFormats: {
                ub: new pc.UniformBufferFormat(device, [
                    new pc.UniformFormat('tint', pc.UNIFORMTYPE_VEC4),
                    new pc.UniformFormat('offset', pc.UNIFORMTYPE_FLOAT),
                    new pc.UniformFormat('frequency', pc.UNIFORMTYPE_FLOAT)
                ])
            },

              // format of a bind group, providing resources for the compute shader
            computeBindGroupFormat: new pc.BindGroupFormat(device, [
                  // a uniform buffer we provided format for
                new pc.BindUniformBufferFormat('ub', pc.SHADERSTAGE_COMPUTE),
                  // input textures
                new pc.BindTextureFormat('inTexture', pc.SHADERSTAGE_COMPUTE, undefined, undefined, false),
                  // output storage textures
                new pc.BindStorageTextureFormat('outTexture', pc.PIXELFORMAT_RGBA8, pc.TEXTUREDIMENSION_2D)
            ])
        }) :
        null;

    // helper function, which creates a cube entity, and an instance of the compute shader that will
    // update its texture each frame
    const createCubeInstance = (/** @type {pc.Vec3} */ position) => {
        if (!device.supportsCompute) return null;

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

        // create an instance of the compute shader, and set the input and output textures
        const compute = new pc.Compute(device, shader, 'ComputeModifyTexture');
        compute.setParameter('inTexture', assets.texture.resource);
        compute.setParameter('outTexture', storageTexture);

        // add a box in the scene, using the storage texture as a material
        const material = new pc.StandardMaterial();
        material.diffuseMap = storageTexture;
        material.gloss = 0.6;
        material.metalness = 0.4;
        material.useMetalness = true;
        material.update();

        const solid = assets.solid.resource.instantiateRenderEntity();
        solid.findByName('Object_3').render.meshInstances[0].material = material;

        // add the script to rotate the object
        solid.addComponent('script');
        solid.script.create('rotator');

        // place it in the world
        solid.setLocalPosition(position);
        solid.setLocalScale(0.25, 0.25, 0.25);
        app.root.addChild(solid);

        return compute;
    };

    // create two instances of cube / compute shader
    const compute1 = createCubeInstance(new pc.Vec3(0, 1, 0));
    const compute2 = createCubeInstance(new pc.Vec3(0, -1, 0));

    let time = 0;
    const srcTexture = assets.texture.resource;
    app.on('update', function (/** @type {number} */ dt) {
        time += dt;

        if (device.supportsCompute) {
            // set uniform buffer parameters
            compute1.setParameter('offset', 20 * time);
            compute1.setParameter('frequency', 0.1);
            compute1.setParameter('tint', [Math.sin(time) * 0.5 + 0.5, 1, 0, 1]);

            compute2.setParameter('offset', 10 * time);
            compute2.setParameter('frequency', 0.03);
            compute2.setParameter('tint', [1, 0, Math.sin(time) * 0.5 + 0.5, 1]);

            // set up both dispatches
            compute1.setupDispatch(srcTexture.width, srcTexture.height);
            compute2.setupDispatch(srcTexture.width, srcTexture.height);

            // dispatch both compute shaders in a single compute pass
            device.computeDispatch([compute1, compute2]);

            // debug render the generated textures
            app.drawTexture(0.6, 0.5, 0.6, 0.3, compute1.getParameter('outTexture'));
            app.drawTexture(0.6, -0.5, 0.6, 0.3, compute2.getParameter('outTexture'));
        }
    });
});

export { app };
