// @config HIDDEN
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';
const { createGoochMaterial } = await fileImport(`${rootPath}/static/assets/scripts/misc/gooch-material.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    terrain: new pc.Asset('terrain', 'container', { url: `${rootPath}/static/assets/models/terrain.glb` }),
    biker: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
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
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem,
    pc.ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.GSplatHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
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

    // setup skydome
    app.scene.skyboxMip = 0;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -70, 0);

    // STANDARD MATERIAL ----------

    /** @type {pc.Entity} */
    const terrain = assets.terrain.resource.instantiateRenderEntity();
    terrain.setLocalScale(30, 30, 30);
    app.root.addChild(terrain);

    // GSPLAT MATERIAL ----------

    const biker = new pc.Entity();
    biker.addComponent('gsplat', {
        asset: assets.biker
    });
    biker.setLocalPosition(0, 0, 150);
    biker.setLocalEulerAngles(180, 90, 0);
    biker.setLocalScale(20, 20, 20);
    app.root.addChild(biker);

    // SHADER MATERIAL ----------

    const box = new pc.Entity('ShaderMaterial');
    const boxMaterial = createGoochMaterial(null, [0.13, 0.55, 0.13]);
    box.addComponent('render', {
        type: 'box',
        material: boxMaterial
    });
    box.setLocalScale(30, 30, 30);
    box.setLocalPosition(-70, 30, 130);
    app.root.addChild(box);

    // LIT MATERIAL ----------

    const material = new pc.LitMaterial();
    material.setParameter('texture_envAtlas', assets.helipad.resource);
    material.setParameter('material_reflectivity', 1.0);
    material.useSkybox = true;
    material.hasSpecular = true;
    material.hasSpecularityFactor = true;
    material.hasNormals = true;
    material.hasMetalness = true;
    material.occludeSpecular = pc.SPECOCC_AO;

    material.shaderChunkGLSL = `
        #include "litShaderCorePS"
        void evaluateFrontend() {
            litArgs_emission = vec3(0.7, 0.4, 0);
            litArgs_metalness = 0.5;
            litArgs_specularity = vec3(0.5, 0.5, 0.5);
            litArgs_specularityFactor = 1.0;
            litArgs_gloss = 0.5;
            litArgs_ior = 0.1;
            litArgs_ao = 0.0;
            litArgs_opacity = 1.0;
        }`;
    material.shaderChunkWGSL = `
        #include "litShaderCorePS"
        fn evaluateFrontend() {
            litArgs_emission = vec3f(0.7, 0.4, 0);
            litArgs_metalness = 0.5;
            litArgs_specularity = vec3f(0.5, 0.5, 0.5);
            litArgs_specularityFactor = 1.0;
            litArgs_gloss = 0.5;
            litArgs_ior = 0.1;
            litArgs_ao = 0.0;
            litArgs_opacity = 1.0;
        }`;
    material.update();

    // create primitive
    const primitive = new pc.Entity();
    primitive.addComponent('render', {
        type: 'sphere',
        material: material
    });

    primitive.setLocalScale(30, 30, 30);
    primitive.setLocalPosition(-170, 30, 130);
    app.root.addChild(primitive);

    // PARTICLE SYSTEM ----------

    const localVelocityCurve = new pc.CurveSet([
        [0, 0, 0.5, 30],
        [0, 0, 0.5, 30],
        [0, 0, 0.5, 30]
    ]);
    const localVelocityCurve2 = new pc.CurveSet([
        [0, 0, 0.5, -30],
        [0, 0, 0.5, -30],
        [0, 0, 0.5, -30]
    ]);
    const worldVelocityCurve = new pc.CurveSet([
        [0, 0],
        [0, 0, 0.2, 6, 1, 300],
        [0, 0]
    ]);

    // Create entity for particle system
    const entity = new pc.Entity('ParticleSystem');
    app.root.addChild(entity);
    entity.setLocalPosition(0, 20, 0);

    // add particlesystem component to entity
    entity.addComponent('particlesystem', {
        numParticles: 200,
        lifetime: 1,
        rate: 0.01,
        scaleGraph: new pc.Curve([0, 10]),
        velocityGraph: worldVelocityCurve,
        localVelocityGraph: localVelocityCurve,
        localVelocityGraph2: localVelocityCurve2,
        colorGraph: new pc.CurveSet([
            [0, 1, 0.25, 1],
            [0, 0, 0.25, 0.3],
            [0, 0, 1, 0]
        ])
    });

    // --------

    // create an Entity with a camera component
    const camera = new pc.Entity('MainCamera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.9, 0.9, 0.9),
        farClip: 1000,
        toneMapping: pc.TONEMAP_ACES,
        fog: {
            color: new pc.Color(0.8, 0.8, 0.8),
            start: 400,
            end: 800,
            density: 0.001,
            type: pc.FOG_LINEAR
        }
    });

    // and position it in the world
    camera.setLocalPosition(-500, 60, 300);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 500
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // Create a directional light casting soft shadows
    const dirLight = new pc.Entity('Cascaded Light');
    dirLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        shadowBias: 0.3,
        normalOffsetBias: 0.2,
        intensity: 1.0,

        // enable shadow casting
        castShadows: true,
        shadowType: pc.SHADOW_PCF3_32F,
        shadowDistance: 1000,
        shadowResolution: 2048
    });
    app.root.addChild(dirLight);
    dirLight.setLocalEulerAngles(75, 120, 20);

    // handle HUD changes
    data.on('*:set', (path, value) => {
        const propertyName = path.split('.')[1];
        if (propertyName === 'tonemapping') {
            // set up selected tone-mapping
            camera.camera.toneMapping = value;
        }
        if (propertyName === 'fog') {
            camera.camera.fog.type = value;
        }
        if (propertyName === 'gamma') {
            camera.camera.gammaCorrection = value ? pc.GAMMA_SRGB : pc.GAMMA_NONE;
        }
    });

    // initial values
    data.set('data', {
        tonemapping: pc.TONEMAP_ACES,
        fog: pc.FOG_LINEAR,
        gamma: true
    });
});

export { app };
