import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    envAtlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/table-mountain-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    table: new pc.Asset('table', 'container', { url: rootPath + '/static/assets/models/glass-table.glb' }),
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    diffuse: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js',

    // disable anti-aliasing as TAA is used to smooth edges
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

// render at full native resolution
device.maxPixelRatio = window.devicePixelRatio;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ScriptHandler, pc.ContainerHandler];

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
    app.scene.envAtlas = assets.envAtlas.resource;
    app.scene.skyboxMip = 2;
    app.scene.exposure = 2.5;

    /**
     * Helper function to create a primitive with shape type, position, scale, color and layer.
     *
     * @param {string} primitiveType - The primitive type.
     * @param {number | pc.Vec3} position - The position.
     * @param {number | pc.Vec3} scale - The scale.
     * @param {pc.Color} color - The color.
     * @returns {pc.Material} The returned entity.
     */
    function createPrimitive(primitiveType, position, scale, color) {
        // create material of specified color
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.diffuseMap = assets.diffuse.resource;
        material.update();

        // create primitive
        const primitive = new pc.Entity(primitiveType);
        primitive.addComponent('render', {
            type: primitiveType,
            material: material
        });

        // set position and scale and add it to scene
        primitive.setLocalPosition(position);
        primitive.setLocalScale(scale);
        app.root.addChild(primitive);

        return material;
    }

    // create a ground plane
    createPrimitive('plane', new pc.Vec3(0, 0, 0), new pc.Vec3(30, 1, 30), new pc.Color(0.5, 0.5, 0.5));

    // create an instance of the table
    const tableEntity = assets.table.resource.instantiateRenderEntity();
    tableEntity.setLocalScale(3, 3, 3);
    app.root.addChild(tableEntity);

    // get all materials that have blending enabled
    const materials = [];
    tableEntity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((meshInstance) => {
            if (meshInstance.material.blendType !== pc.BLEND_NONE) {
                materials.push(meshInstance.material);
            }
        });
    });

    // Create an Entity with a directional light, casting soft VSM shadow
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        range: 200,
        castShadows: true,
        shadowResolution: 2048,
        shadowType: pc.SHADOW_VSM16,
        vsmBlurSize: 20,
        shadowBias: 0.1,
        normalOffsetBias: 0.1
    });
    light.setLocalEulerAngles(75, 120, 20);
    app.root.addChild(light);

    // Create the camera
    const cameraEntity = new pc.Entity('Camera');
    cameraEntity.addComponent('camera', {
        fov: 70
    });
    cameraEntity.translate(-14, 12, 12);
    cameraEntity.lookAt(1, 4, 0);
    app.root.addChild(cameraEntity);

    // enable the camera to render the scene's color map, as the table material needs it
    cameraEntity.camera.requestSceneColorMap(true);

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: tableEntity,
            distanceMax: 30,
            frameOnStart: false
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    // ------ Custom render passes set up ------

    const currentOptions = {
        camera: cameraEntity.camera, // camera used to render those passes
        samples: 0, // number of samples for multi-sampling
        sceneColorMap: true,
        bloomEnabled: false,

        // enable the pre-pass to generate the depth buffer, which is needed by the TAA
        prepassEnabled: true,

        // enable temporal anti-aliasing
        taaEnabled: true
    };

    const setupRenderPass = () => {
        // destroy existing pass if any
        if (cameraEntity.camera.renderPasses.length > 0) {
            cameraEntity.camera.renderPasses[0].destroy();
        }

        // Use a render pass camera frame, which is a render pass that implements typical rendering of a camera.
        // Internally this sets up additional passes it needs, based on the options passed to it.
        const renderPassCamera = new pc.RenderPassCameraFrame(app, currentOptions);

        const composePass = renderPassCamera.composePass;
        composePass.toneMapping = pc.TONEMAP_ACES;
        composePass.sharpness = currentOptions.taaEnabled ? 1 : 0;

        // and set up these rendering passes to be used by the camera, instead of its default rendering
        cameraEntity.camera.renderPasses = [renderPassCamera];

        // jitter the camera when TAA is enabled
        cameraEntity.camera.jitter = currentOptions.taaEnabled ? 1 : 0;
    };

    setupRenderPass();

    // ------

    // handle UI changes
    data.on('*:set', (/** @type {string} */ path, value) => {
        const propertyName = path.split('.')[1];
        materials.forEach((material) => {
            // apply the value to the material
            material[propertyName] = value;

            if (propertyName === 'opacityDither') {
                // turn on / off blending depending on the dithering of the color
                material.blendType = value === pc.DITHER_NONE ? pc.BLEND_NORMAL : pc.BLEND_NONE;

                // turn on / off depth write depending on the dithering of the color
                material.depthWrite = value !== pc.DITHER_NONE;
            }

            material.update();

            // if TAA property changes, we need to set up render passes again
            if (propertyName === 'taa') {
                if (currentOptions.taaEnabled !== value) {
                    currentOptions.taaEnabled = value;
                    setupRenderPass();
                }
            }
        });
    });

    // initial values
    data.set('data', {
        taa: false,
        opacity: 0.5,
        opacityDither: pc.DITHER_BAYER8,
        opacityShadowDither: pc.DITHER_BAYER8
    });
});

export { app };
