import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: rootPath + '/static/lib/draco/draco.wasm.js',
    wasmUrl: rootPath + '/static/lib/draco/draco.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/draco/draco.js'
});

const assets = {
    laboratory: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/laboratory.glb' }),
    orbit: new pc.Asset('orbit', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    ssao: new pc.Asset('ssao', 'script', { url: rootPath + '/static/scripts/posteffects/posteffect-ssao.js' }),
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
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [
    pc.ScriptHandler,
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.FontHandler
];

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
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxMip = 2;
    app.scene.exposure = 2.5;

    // get the instance of the laboratory
    const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    });
    laboratoryEntity.setLocalScale(100, 100, 100);
    app.root.addChild(laboratoryEntity);

    // set up materials
    laboratoryEntity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((meshInstance) => {

            // disable blending / enable depth writes
            meshInstance.material.depthState = pc.DepthState.DEFAULT;
            meshInstance.material.blendType = pc.BLEND_NONE;

            // disable baked AO map as we want to use SSAO only
            meshInstance.material.aoMap = null;
            meshInstance.material.update();
        });
    });

    // add lights to the torches
    const torches = laboratoryEntity.find(node => node.name.indexOf('Fackel') !== -1);
    torches.forEach((torch) => {
        const light = new pc.Entity('Omni');
        light.addComponent('light', {
            type: 'omni',
            color: new pc.Color(1, 0.75, 0),
            intensity: 3,
            range: 100,
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.2,
            shadowUpdateMode: pc.SHADOWUPDATE_THISFRAME
        });
        light.setLocalPosition(torch.children[0].render.meshInstances[0].aabb.center);
        app.root.addChild(light);
    });

    // add a ground plane
    const planeMaterial = new pc.StandardMaterial();
    planeMaterial.diffuse = new pc.Color(0.2, 0.2, 0.2);
    planeMaterial.update();

    const primitive = new pc.Entity();
    primitive.addComponent('render', {
        type: 'plane',
        material: planeMaterial
    });
    primitive.setLocalScale(new pc.Vec3(400, 1, 400));
    primitive.setLocalPosition(0, -40, 0);
    app.root.addChild(primitive);

    // Create a directional light
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        intensity: 1,
        castShadows: true,
        shadowResolution: 4096,
        shadowBias: 0.4,
        normalOffsetBias: 0.06,
        shadowDistance: 600,
        shadowUpdateMode: pc.SHADOWUPDATE_THISFRAME
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(35, 30, 0);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5),
        nearClip: 1,
        farClip: 600
    });

    // add orbit camera script
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: laboratoryEntity,
            distanceMax: 350
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    // position the camera in the world
    cameraEntity.setLocalPosition(-60, 30, 60);
    app.root.addChild(cameraEntity);

    // ------ Custom render passes set up ------

    const currentOptions = {
        camera: cameraEntity.camera, // camera used to render those passes
        samples: 1, // number of samples for multi-sampling
        sceneColorMap: false,
        bloomEnabled: false,

        // enable the pre-pass to generate the depth buffer, which is needed by the SSAO
        prepassEnabled: true,

        // enable temporal anti-aliasing
        taaEnabled: false,

        ssaoEnabled: true,
        ssaoBlurEnabled: true
    };

    const setupRenderPass = () => {
        // destroy existing pass if any
        if (cameraEntity.camera.renderPasses.length > 0) {
            cameraEntity.camera.renderPasses[0].destroy();
        }

        // Use a render pass camera frame, which is a render pass that implements typical rendering of a camera.
        // Internally this sets up additional passes it needs, based on the options passed to it.
        const renderPassCamera = new pc.RenderPassCameraFrame(app, currentOptions);

        renderPassCamera.ssaoEnabled = currentOptions.ssaoEnabled;

        const composePass = renderPassCamera.composePass;
        composePass.sharpness = 0;

        // and set up these rendering passes to be used by the camera, instead of its default rendering
        cameraEntity.camera.renderPasses = [renderPassCamera];

        // jitter the camera when TAA is enabled
        cameraEntity.camera.jitter = currentOptions.taaEnabled ? 1 : 0;
    };

    const applySettings = () => {
        // if settings require render passes to be re-created
        const noPasses = cameraEntity.camera.renderPasses.length === 0;
        const ssaoEnabled = data.get('data.ssao.enabled');
        const blurEnabled = data.get('data.ssao.blurEnabled');
        if (noPasses || ssaoEnabled !== currentOptions.ssaoEnabled || blurEnabled !== currentOptions.ssaoBlurEnabled) {
            currentOptions.ssaoEnabled = ssaoEnabled;
            currentOptions.ssaoBlurEnabled = blurEnabled;

            // create new pass
            setupRenderPass();
        }

        const renderPassCamera = cameraEntity.camera.renderPasses[0];

        // ssao settings
        const ssaoPass = renderPassCamera.ssaoPass;
        if (ssaoPass) {

            ssaoPass.intensity = data.get('data.ssao.intensity');
            ssaoPass.power = data.get('data.ssao.power');
            ssaoPass.radius = data.get('data.ssao.radius');
            ssaoPass.sampleCount = data.get('data.ssao.samples');
            ssaoPass.minAngle = data.get('data.ssao.minAngle');
            ssaoPass.scale = data.get('data.ssao.scale');
        }
    };

    // apply UI changes
    let initialValuesSetup = false;
    data.on('*:set', (/** @type {string} */ path, value) => {
        if (initialValuesSetup)
            applySettings();

        const pathArray = path.split('.');
        if (pathArray[2] === 'scale') {
            // adjust min angle based on scale to avoid depth related artifacts
            if (value < 0.6)
                data.set('data.ssao.minAngle', 40);
            else if (value < 0.8)
                data.set('data.ssao.minAngle', 20);
            else
                data.set('data.ssao.minAngle', 10);
        }
    });

    // initial settings
    data.set('data', {
        ssao: {
            enabled: true,
            blurEnabled: true,
            radius: 30,
            samples: 12,
            intensity: 0.4,
            power: 6,
            minAngle: 10,
            scale: 1
        }
    });

    // apply initial settings after all values are set
    initialValuesSetup = true;
    applySettings();
});

export { app };
