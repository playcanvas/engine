import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    dish: new pc.Asset('dish', 'container', { url: rootPath + '/static/assets/models/IridescentDishWithOlives.glb' }),
    mosquito: new pc.Asset('mosquito', 'container', { url: rootPath + '/static/assets/models/MosquitoInAmber.glb' }),
    sheen: new pc.Asset('sheen', 'container', { url: rootPath + '/static/assets/models/SheenChair.glb' }),
    lamp: new pc.Asset('lamp', 'container', { url: rootPath + '/static/assets/models/StainedGlassLamp.glb' }),
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/arial.json' }),
    checkerboard: new pc.Asset('checkerboard', 'texture', { url: rootPath + '/static/assets/textures/checkboard.png' })
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
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.JsonHandler,
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

    // Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
    // Move the depth layer to take place after World and Skydome layers, to capture both of them.
    const depthLayer = app.scene.layers.getLayerById(pc.LAYERID_DEPTH);
    app.scene.layers.remove(depthLayer);
    app.scene.layers.insertOpaque(depthLayer, 2);
    /**
     * @param {pc.Asset} fontAsset - The font asset.
     * @param {string} message - The message.
     * @param {number} x - The x coordinate.
     * @param {number} z - The z coordinate.
     */
    const createText = (fontAsset, message, x, z) => {
        // Create a text element-based entity
        const text = new pc.Entity();
        text.addComponent('element', {
            anchor: [0.5, 0.5, 0.5, 0.5],
            fontAsset: fontAsset,
            fontSize: 0.2,
            pivot: [0.5, 0.5],
            text: message,
            type: pc.ELEMENTTYPE_TEXT
        });
        text.setLocalPosition(x, -0.9, z);
        text.setLocalEulerAngles(-90, 0, 0);
        app.root.addChild(text);
    };

    /**
     * @param {any} resource - The asset resource.
     * @param {pc.Vec3} pos - The position.
     * @param {number} scale - The scale.
     * @returns {pc.Entity} The returned entity.
     */
    const createVisual = (resource, pos, scale) => {
        const entity = resource.instantiateRenderEntity({
            castShadows: true
        });
        entity.setLocalScale(scale, scale, scale);
        entity.setLocalPosition(pos);
        app.root.addChild(entity);

        return entity;
    };

    let currentAssetIndex = 0;

    // create the scene by instantiating glbs
    const mosquito = createVisual(assets.mosquito.resource, new pc.Vec3(0, 0.5, 0), 25);
    createText(assets.font, 'KHR_materials_volume\nKHR_materials_ior\nKHR_materials_transmission', 0, 2);

    const dish = createVisual(assets.dish.resource, new pc.Vec3(-4, -0.5, 0), 9);
    createText(
        assets.font,
        'KHR_materials_specular\nKHR_materials_volume\nKHR_materials_ior\nKHR_materials_transmission',
        -4,
        2
    );

    const sheen1 = createVisual(assets.sheen.resource, new pc.Vec3(8, -1.0, 0), 4);
    createText(assets.font, 'Mango Velvet', 8, 1);

    const sheen2 = createVisual(assets.sheen.resource, new pc.Vec3(4, -1.0, 0), 4);
    assets.sheen.resource.applyMaterialVariant(sheen2, 'Peacock Velvet');
    createText(assets.font, 'KHR_materials_sheen\nKHR_materials_variants', 5.5, 2);
    createText(assets.font, 'Peacock Velvet', 4, 1);

    const lamp = createVisual(assets.lamp.resource, new pc.Vec3(-8, -1.0, 0), 5);
    createText(assets.font, 'Lamp on', -8, 1);

    const lamp2 = createVisual(assets.lamp.resource, new pc.Vec3(-11, -1.0, 0), 5);
    assets.lamp.resource.applyMaterialVariant(lamp2, 'Lamp off');
    createText(assets.font, 'Lamp off', -11, 1);
    createText(
        assets.font,
        'KHR_materials_transmission\nKHR_materials_ior\nKHR_materials_volume\nKHR_materials_variants\nKHR_materials_clearcoat',
        -9.5,
        2
    );

    const assetList = [lamp2, lamp, dish, mosquito, sheen2, sheen1];

    const material = new pc.StandardMaterial();
    material.diffuseMap = assets.checkerboard.resource;
    material.diffuseMapTiling = new pc.Vec2(16, 6);
    material.update();
    const plane = new pc.Entity();
    plane.addComponent('render', {
        type: 'plane',
        material: material
    });
    plane.setLocalScale(new pc.Vec3(25, 0, 10));
    plane.setLocalPosition(0, -1.0, 0);
    app.root.addChild(plane);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {});
    camera.setLocalPosition(0, 55, 160);

    camera.camera.requestSceneColorMap(true);
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMin: 8,
            distanceMax: 50
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    const directionalLight = new pc.Entity();
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        castShadows: true,
        intensity: 1,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shadowResolution: 2048
    });
    directionalLight.setEulerAngles(45, 180, 0);
    app.root.addChild(directionalLight);

    app.scene.envAtlas = assets.helipad.resource;
    app.scene.rendering.toneMapping = pc.TONEMAP_NEUTRAL;
    app.scene.skyboxMip = 1;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 70, 0);
    app.scene.skyboxIntensity = 1.5;

    window.addEventListener(
        'touchstart',
        (event) => {
            const touch = event.touches[0];
            const entity = data.get('selection.focusEntity');
            let newEntity = entity;
            if (touch.clientX <= canvas.width * 0.2) {
                newEntity = Math.max(0, entity - 1);
            } else if (touch.clientX >= canvas.width * 0.8) {
                newEntity = Math.min(entity + 1, assetList.length);
            }
            if (entity !== newEntity) {
                data.set('selection.focusEntity', newEntity);
            }
        },
        false
    );
    /**
     * @param {number} offset - The offset to jump to.
     */
    function jumpToAsset(offset) {
        // wrap around
        const count = assetList.length - 1;
        currentAssetIndex += offset;
        if (currentAssetIndex < 0) currentAssetIndex = count;
        if (currentAssetIndex > count) currentAssetIndex = 0;

        const pos = assetList[currentAssetIndex].getLocalPosition();
        const newPos = new pc.Vec3(0, 2.0, 6.0).add(pos);
        camera.setLocalPosition(newPos);

        // @ts-ignore engine-tsd
        camera.script.orbitCamera.focusEntity = assetList[currentAssetIndex];
    }

    // focus on mosquito
    jumpToAsset(3);

    data.on('previous', function () {
        jumpToAsset(-1);
    });

    // remove light button handler
    data.on('next', function () {
        jumpToAsset(1);
    });
});

export { app };
