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
    orbit: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    platform: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/scifi-platform.glb' }),
    mosquito: new pc.Asset('mosquito', 'container', { url: rootPath + '/static/assets/models/MosquitoInAmber.glb' }),
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/arial.json' }),
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
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js',

    // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
    // to avoid the additional cost. This is only used for the UI which renders on top of the
    // post-processed scene, and we're typically happy with some aliasing on the UI.
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.FontHandler];

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

    // setup skydome with low intensity
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxMip = 2;
    app.scene.exposure = 0.3;

    // disable skydome rendering itself, we don't need it as we use camera clear color
    app.scene.layers.getLayerByName('Skybox').enabled = false;

    // create an instance of the platform and add it to the scene
    const platformEntity = assets.platform.resource.instantiateRenderEntity();
    platformEntity.setLocalScale(10, 10, 10);
    app.root.addChild(platformEntity);

    // get a list of emissive materials from the scene to allow their intensity to be changed
    const emissiveMaterials = [];
    const emissiveNames = new Set(['Light_Upper_Light-Upper_0', 'Emissive_Cyan__0']);
    platformEntity.findComponents('render').forEach((render) => {
        if (emissiveNames.has(render.entity.name)) {
            render.meshInstances.forEach(meshInstance => emissiveMaterials.push(meshInstance.material));
        }
    });

    // add an instance of the mosquito mesh
    const mosquitoEntity = assets.mosquito.resource.instantiateRenderEntity();
    mosquitoEntity.setLocalScale(600, 600, 600);
    mosquitoEntity.setLocalPosition(0, 20, 0);
    app.root.addChild(mosquitoEntity);

    // helper function to create a box primitive
    const createBox = (x, y, z, r, g, b, emissive, name) => {
        // create material of random color
        const material = new pc.StandardMaterial();
        material.diffuse = pc.Color.BLACK;
        material.emissive = new pc.Color(r, g, b);
        material.emissiveIntensity = emissive;
        material.update();

        // create primitive
        const primitive = new pc.Entity(name);
        primitive.addComponent('render', {
            type: 'box',
            material: material
        });

        // set position and scale
        primitive.setLocalPosition(x, y, z);
        app.root.addChild(primitive);

        return primitive;
    };

    // create 3 emissive boxes
    const boxes = [
        createBox(100, 20, 0, 1, 0, 0, 60, 'boxRed'),
        createBox(-50, 20, 100, 0, 1, 0, 60, 'boxGreen'),
        createBox(90, 20, -80, 1, 1, 0.25, 50, 'boxYellow')
    ];

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        farClip: 500,
        fov: 80
    });

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');

    // add orbit camera script with a mouse and a touch support
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: mosquitoEntity,
            distanceMax: 190,
            frameOnStart: false
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    cameraEntity.setLocalPosition(0, 40, -220);
    cameraEntity.lookAt(0, 0, 100);
    app.root.addChild(cameraEntity);

    // Create a 2D screen to place UI on
    const screen = new pc.Entity();
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });
    app.root.addChild(screen);

    // add a shadow casting directional light
    const lightColor = new pc.Color(1, 0.7, 0.1);
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: lightColor,
        intensity: 80,
        range: 400,
        shadowResolution: 4096,
        shadowDistance: 400,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(80, 10, 0);

    // a helper function to add a label to the screen
    const addLabel = (name, text, x, y, layer) => {
        const label = new pc.Entity(name);
        label.addComponent('element', {
            text: text,
            color: new pc.Color(100, 50, 80), // very bright color to affect the bloom
            anchor: new pc.Vec4(x, y, 0.5, 0.5),
            fontAsset: assets.font,
            fontSize: 28,
            pivot: new pc.Vec2(0.5, 0.1),
            type: pc.ELEMENTTYPE_TEXT,
            alignment: pc.Vec2.ZERO,
            layers: [layer.id]
        });
        screen.addChild(label);
    };

    // add a label on the world layer, which will be affected by post-processing
    const worldLayer = app.scene.layers.getLayerByName('World');
    addLabel('WorldUI', 'Text on the World layer affected by post-processing', 0.1, 0.9, worldLayer);

    // add a label on the UI layer, which will be rendered after the post-processing
    const uiLayer = app.scene.layers.getLayerById(pc.LAYERID_UI);
    addLabel('TopUI', 'Text on theUI layer after the post-processing', 0.1, 0.1, uiLayer);

    // ------ Custom render passes set up ------

    const currentOptions = {
        camera: cameraEntity.camera, // camera used to render those passes
        samples: 0, // number of samples for multi-sampling
        sceneColorMap: true, // true if the scene color should be captured
        bloomEnabled: true,

        // disabled TAA as it currently does not handle dynamic objects
        prepassEnabled: false,
        taaEnabled: false
    };

    const setupRenderPass = () => {
        // destroy existing pass if any
        if (cameraEntity.camera.renderPasses.length > 0) {
            cameraEntity.camera.renderPasses[0].destroy();
        }

        // Use a render pass camera frame, which is a render pass that implements typical rendering of a camera.
        // Internally this sets up additional passes it needs, based on the options passed to it.
        const renderPassCamera = new pc.RenderPassCameraFrame(app, currentOptions);

        // and set up these rendering passes to be used by the camera, instead of its default rendering
        cameraEntity.camera.renderPasses = [renderPassCamera];
    };

    // ------

    const applySettings = () => {
        // if settings require render passes to be re-created
        const noPasses = cameraEntity.camera.renderPasses.length === 0;
        const taaEnabled = data.get('data.taa.enabled');
        const bloomEnabled = data.get('data.bloom.enabled');

        if (noPasses || taaEnabled !== currentOptions.taaEnabled || bloomEnabled !== currentOptions.bloomEnabled) {
            currentOptions.taaEnabled = taaEnabled;
            currentOptions.bloomEnabled = bloomEnabled;
            currentOptions.prepassEnabled = taaEnabled;

            // create new pass
            setupRenderPass();
        }

        const renderPassCamera = cameraEntity.camera.renderPasses[0];
        const composePass = renderPassCamera.composePass;

        // apply all runtime settings

        // SCENE
        composePass.toneMapping = data.get('data.scene.tonemapping');
        renderPassCamera.renderTargetScale = data.get('data.scene.scale');

        const background = data.get('data.scene.background');
        cameraEntity.camera.clearColor = new pc.Color(
            lightColor.r * background,
            lightColor.g * background,
            lightColor.b * background
        );
        light.light.intensity = background;

        const emissive = data.get('data.scene.emissive');
        emissiveMaterials.forEach((material) => {
            material.emissiveIntensity = emissive;
            material.update();
        });

        // taa - enable camera jitter if taa is enabled
        cameraEntity.camera.jitter = taaEnabled ? data.get('data.taa.jitter') : 0;

        // bloom
        if (bloomEnabled) {
            renderPassCamera.lastMipLevel = data.get('data.bloom.lastMipLevel');
            composePass.bloomIntensity = pc.math.lerp(0, 0.1, data.get('data.bloom.intensity') / 100);
        }

        // grading
        composePass.gradingSaturation = data.get('data.grading.saturation');
        composePass.gradingBrightness = data.get('data.grading.brightness');
        composePass.gradingContrast = data.get('data.grading.contrast');
        composePass.gradingEnabled = data.get('data.grading.enabled');

        // vignette
        composePass.vignetteEnabled = data.get('data.vignette.enabled');
        composePass.vignetteInner = data.get('data.vignette.inner');
        composePass.vignetteOuter = data.get('data.vignette.outer');
        composePass.vignetteCurvature = data.get('data.vignette.curvature');
        composePass.vignetteIntensity = data.get('data.vignette.intensity');

        // fringing
        composePass.fringingEnabled = data.get('data.fringing.enabled');
        composePass.fringingIntensity = data.get('data.fringing.intensity');
    };

    // apply UI changes
    let initialValuesSetup = false;
    data.on('*:set', () => {
        if (initialValuesSetup) applySettings();
    });

    // set initial values
    data.set('data', {
        scene: {
            scale: 1.8,
            background: 6,
            emissive: 200,
            tonemapping: pc.TONEMAP_ACES
        },
        bloom: {
            enabled: currentOptions.bloomEnabled,
            intensity: 10,
            lastMipLevel: 1
        },
        grading: {
            enabled: false,
            saturation: 1,
            brightness: 1,
            contrast: 1
        },
        vignette: {
            enabled: false,
            inner: 0.5,
            outer: 1.0,
            curvature: 0.5,
            intensity: 0.3
        },
        fringing: {
            enabled: false,
            intensity: 50
        },
        taa: {
            enabled: currentOptions.taaEnabled,
            jitter: 1
        }
    });

    // apply initial settings after all values are set
    initialValuesSetup = true;
    applySettings();

    // update things every frame
    let angle = 0;
    app.on('update', function (/** @type {number} */ dt) {
        angle += dt;

        // scale the boxes
        for (let i = 0; i < boxes.length; i++) {
            const offset = (Math.PI * 2 * i) / boxes.length;
            const scale = 25 + Math.sin(angle + offset) * 10;
            boxes[i].setLocalScale(scale, scale, scale);
        }

        // rotate the mosquitoEntity
        mosquitoEntity.setLocalEulerAngles(0, angle * 30, 0);
    });
});

export { app };
