// @config
//
// Independent strengths for alpha blending and opacity dithering. Both tables have alpha blending
// and dither enabled. Left: `alphaDither` untouched — opacity drives both blend and dither
// (legacy behavior). Right: `alphaDither` driven by its slider — opacity drives only blend;
// **Alpha Dither** drives only dither.
//
// @credit
// title: Low-poly Glass Table
// author: Sketchfab
// source: https://sketchfab.com/3d-models/low-poly-glass-table-6acac6d9201e448b92dff859b6f63aad
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    envAtlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    table: new pc.Asset('table', 'container', { url: './assets/models/glass-table.glb' }),
    script: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    diffuse: new pc.Asset('color', 'texture', { url: './assets/textures/playcanvas.png' })
};

const gfxOptions = {
    deviceTypes: [deviceType],

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
    app.scene.exposure = 4.5;

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
    createPrimitive('plane', new pc.Vec3(0, 0, 0), new pc.Vec3(60, 1, 30), new pc.Color(0.8, 0.8, 0.8));

    /**
     * Instantiate the glass table, collect its alpha-blended materials. Each blended material is
     * cloned so the two tables can be configured independently.
     *
     * @param {pc.Vec3} position - The world-space position to place the table at.
     * @returns {pc.StandardMaterial[]} The alpha-blended materials of the instantiated table.
     */
    const spawnTable = (position) => {
        const entity = assets.table.resource.instantiateRenderEntity();
        entity.setLocalScale(3, 3, 3);
        entity.setLocalPosition(position);
        app.root.addChild(entity);

        const materials = [];
        entity.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((meshInstance) => {
                if (meshInstance.material.blendType !== pc.BLEND_NONE) {
                    meshInstance.material = meshInstance.material.clone();
                    materials.push(meshInstance.material);
                }
            });
        });
        return materials;
    };

    // LEFT — BC demo: alphaDither stays untouched (implicit) so opacity drives both blend
    // strength and dither density, exactly like the legacy engine
    const leftMaterials = spawnTable(new pc.Vec3(-7, 0, 0));

    // RIGHT — new feature: alphaDither set explicitly from the slider, decoupled from opacity
    const rightMaterials = spawnTable(new pc.Vec3(7, 0, 0));

    // Create an Entity with a directional light, casting soft VSM shadow
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        range: 200,
        castShadows: true,
        shadowResolution: 2048,
        shadowType: pc.SHADOW_VSM_16F,
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
    cameraEntity.translate(-14, 12, 20);
    cameraEntity.lookAt(0, 4, 0);
    app.root.addChild(cameraEntity);

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 40,
            frameOnStart: false
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    // ------ Custom render passes set up ------

    const cameraFrame = new pc.CameraFrame(app, cameraEntity.camera);
    cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
    cameraFrame.rendering.sceneColorMap = true;
    cameraFrame.taa.jitter = 1;
    cameraFrame.update();

    const applySettings = () => {
        cameraFrame.taa.enabled = data.get('data.taa');
        cameraFrame.rendering.sharpness = cameraFrame.taa.enabled ? 1 : 0;
        cameraFrame.update();
    };

    // ------

    // alphaDither is routed to the right table only — leaving the left's _alphaDither at its
    // null default, so its dither uses the legacy fallback to opacity. Everything else is applied
    // to both tables so the only difference between them is alphaDither's null vs explicit state.
    const rightOnly = new Set(['alphaDither']);

    // handle UI changes
    data.on('*:set', (/** @type {string} */ path, value) => {
        const propertyName = path.split('.')[1];
        const targets = rightOnly.has(propertyName) ?
            rightMaterials :
            [...leftMaterials, ...rightMaterials];

        targets.forEach((material) => {
            material[propertyName] = value;
            material.update();
        });

        applySettings();
    });

    // initial values — alphaDither starts at 0.5 to match opacity, so on load the right table's
    // dither matches the left's (both look identical). Drag Opacity and only the left's dither
    // density follows; drag Alpha Dither and only the right's does.
    data.set('data', {
        taa: false,
        opacity: 0.5,
        alphaDither: 0.5,
        opacityDither: pc.DITHER_BAYER8,
        opacityShadowDither: pc.DITHER_BAYER8
    });
});
