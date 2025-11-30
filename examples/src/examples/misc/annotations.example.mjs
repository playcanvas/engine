import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { Annotation } = await fileImport(`${rootPath}/static/scripts/esm/annotation.mjs`);
const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { ShadowCatcher } = await fileImport(`${rootPath}/static/scripts/esm/shadow-catcher.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: `${rootPath}/static/lib/draco/draco.wasm.js`,
    wasmUrl: `${rootPath}/static/lib/draco/draco.wasm.wasm`,
    fallbackUrl: `${rootPath}/static/lib/draco/draco.js`
});

// Initialize basis to allow loading of compressed textures
pc.basisInitialize({
    glueUrl: `${rootPath}/static/lib/basis/basis.wasm.js`,
    wasmUrl: `${rootPath}/static/lib/basis/basis.wasm.wasm`,
    fallbackUrl: `${rootPath}/static/lib/basis/basis.js`
});

const assets = {
    jetFighter: new pc.Asset('jet-fighter', 'container', { url: `${rootPath}/static/assets/models/jet-fighter.glb` }),
    shanghai: new pc.Asset(
        'shanghai',
        'texture',
        { url: `${rootPath}/static/assets/hdri/shanghai-riverside-4k.hdr` },
        { mipmaps: false }
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
    pc.ScriptComponentSystem
];
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

    // Setup HDR environment
    const applyHdri = (source) => {
        const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
        app.scene.skybox = skybox;

        const lighting = pc.EnvLighting.generateLightingSource(source);
        const envAtlas = pc.EnvLighting.generateAtlas(lighting);
        lighting.destroy();
        app.scene.envAtlas = envAtlas;
    };

    device.on('devicerestored', () => {
        applyHdri(assets.shanghai.resource);
    });

    applyHdri(assets.shanghai.resource);

    // Setup sky dome
    app.scene.sky.type = pc.SKYTYPE_DOME;
    app.scene.sky.node.setLocalScale(new pc.Vec3(50, 50, 50));
    app.scene.sky.node.setLocalPosition(new pc.Vec3(0, 0, 0));
    app.scene.sky.center = new pc.Vec3(0, 0.1, 0);

    // Create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9),
        farClip: 500,
        toneMapping: pc.TONEMAP_ACES2
    });
    camera.setPosition(0, 1.75, 8);

    // Add camera controls
    camera.addComponent('script');
    camera.script.create(CameraControls, {
        properties: {
            focusPoint: new pc.Vec3(0, 1.75, 0),
            pitchRange: new pc.Vec2(-90, 0),
            sceneSize: 2,
            zoomRange: new pc.Vec2(5, 25)
        }
    });

    app.root.addChild(camera);

    // Create directional light
    const light = new pc.Entity('light');
    light.addComponent('light', {
        type: 'directional',
        castShadows: true,
        shadowDistance: 30,
        shadowIntensity: 0.6,
        shadowResolution: 1024,
        shadowType: pc.SHADOW_VSM_16F
    });
    app.root.addChild(light);

    // Create a wrapper entity for the jet fighter (like pc-model does in web-components)
    const jetFighter = new pc.Entity('jet-fighter');
    jetFighter.setPosition(-2, 1.6, 0);
    jetFighter.setEulerAngles(0, 0, 3);
    app.root.addChild(jetFighter);

    // Instantiate the model as a child of the wrapper
    const jetModel = assets.jetFighter.resource.instantiateRenderEntity({
        castShadows: true
    });
    jetFighter.addChild(jetModel);

    /**
     * Create an annotation entity
     * @param {pc.Vec3} position - Position relative to parent
     * @param {string} label - Label number
     * @param {string} title - Annotation title
     * @param {string} text - Annotation description
     * @returns {pc.Entity} The annotation entity
     */
    const createAnnotation = (position, label, title, text) => {
        const entity = new pc.Entity(`annotation${label}`);
        entity.setLocalPosition(position);
        entity.addComponent('script');
        entity.script.create(Annotation, {
            properties: {
                label: label,
                title: title,
                text: text
            }
        });
        return entity;
    };

    // Add annotations to the jet fighter
    jetFighter.addChild(createAnnotation(
        new pc.Vec3(5.5, 1.2, 0),
        '1',
        'Cockpit Canopy',
        'Transparent canopy offering visibility and housing the pilot\'s controls.'
    ));

    jetFighter.addChild(createAnnotation(
        new pc.Vec3(8, 0.25, 0),
        '2',
        'Nose Cone & Radar',
        'Houses the advanced radar system for targeting and navigation.'
    ));

    jetFighter.addChild(createAnnotation(
        new pc.Vec3(5, -0.5, 0),
        '3',
        'Inlet Ducts',
        'Provides airflow to the engines, crucial for maintaining thrust.'
    ));

    jetFighter.addChild(createAnnotation(
        new pc.Vec3(0.5, 0, 5.1),
        '4',
        'Wingtip Missile Rails',
        'Can be equipped with AIM-9 Sidewinder missiles for air-to-air combat.'
    ));

    jetFighter.addChild(createAnnotation(
        new pc.Vec3(-4, 0, 0),
        '5',
        'Jet Engine Nozzles',
        'Dual afterburning turbofan engines for high-speed performance.'
    ));

    jetFighter.addChild(createAnnotation(
        new pc.Vec3(1, -1, -1),
        '6',
        'Main Landing Gear',
        'Retractable gear for safe takeoff and landing on runways.'
    ));

    jetFighter.addChild(createAnnotation(
        new pc.Vec3(2, 0, -3.1),
        '7',
        'Forward Leading-Edge Flaps',
        'Enhance maneuverability during high-speed or low-speed flight.'
    ));

    // Create shadow catcher
    const shadowCatcher = new pc.Entity('shadowCatcher');
    shadowCatcher.addComponent('script');
    shadowCatcher.script.create(ShadowCatcher, {
        properties: {
            scale: new pc.Vec3(15, 15, 15)
        }
    });
    app.root.addChild(shadowCatcher);
});

export { app };
