// @config HIDDEN
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    font: new pc.Asset('font', 'font', { url: `${rootPath}/static/assets/fonts/arial.json` }),
    rocks: new pc.Asset('rocks', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-diffuse-alpha.png` }, { srgb: true }),


    opacity: new pc.Asset('rocks', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-roughness.jpg` })

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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.ElementComponentSystem, pc.ScriptComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler, pc.ScriptHandler];

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

    // Create an entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1, 1)
    });
    camera.translate(10, 6, 22);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMin: 12,
            distanceMax: 100
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');

    app.root.addChild(camera);

    const NUM_BOXES = 5;

    // alpha blend modes for individual rows
    const blendModes = [pc.BLEND_ADDITIVE, pc.BLEND_ADDITIVEALPHA, pc.BLEND_SCREEN, pc.BLEND_NORMAL, pc.BLEND_NONE];

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @returns {pc.Entity} The returned entity.
     */
    const createPrimitive = function (x, y, z) {

        const material = new pc.StandardMaterial();

        // emissive color
        material.emissive = new pc.Color(x, y, 1 - y);

        // emissive texture
        material.emissiveMap = assets.rocks.resource;

        // opacity map - use a separate texture
        material.opacityMap = assets.opacity.resource;
        material.opacityMapChannel = 'r';

        // disable culling to see back faces as well
        material.cull = pc.CULLFACE_NONE;

        // set up alpha test value
        material.alphaTest = (x + 1) / (NUM_BOXES + 1) - 0.1;

        // alpha blend mode
        material.blendType = blendModes[y];

        const box = new pc.Entity();
        box.addComponent('render', {
            material: material,
            type: 'box',
            castShadows: true
        });
        box.setLocalPosition(x - (NUM_BOXES - 1) * 0.5, y - (NUM_BOXES - 1) * 0.5, z);
        box.setLocalScale(0.7, 0.7, 0.7);
        app.root.addChild(box);

        return box;
    };

    /** @type {Array<pc.Entity>} */
    const boxes = [];
    for (let i = 0; i < NUM_BOXES; i++) {
        for (let j = 0; j < NUM_BOXES; j++) {
            boxes.push(createPrimitive(j, i, 0));
        }
    }
    /**
     * @param {pc.Asset} fontAsset - The font asset.
     * @param {string} message - The message.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} rot - The z coordinate rotation (euler angles).
     */
    const createText = function (fontAsset, message, x, y, z, rot) {
        // Create a text element-based entity
        const text = new pc.Entity();
        text.addComponent('element', {
            anchor: [0.5, 0.5, 0.5, 0.5],
            fontAsset: fontAsset,
            fontSize: 0.5,
            pivot: [0.5, 0.5],
            text: message,
            type: pc.ELEMENTTYPE_TEXT
        });
        text.setLocalPosition(x, y, z);
        text.setLocalEulerAngles(0, 0, rot);
        app.root.addChild(text);
    };

    createText(assets.font, 'Alpha Test', 0, (NUM_BOXES + 1) * 0.5, 0, 0);
    createText(assets.font, 'Alpha Blend', -(NUM_BOXES + 1) * 0.5, 0, 0, 90);

    // ground
    const groundMaterial = new pc.StandardMaterial();
    groundMaterial.diffuse = new pc.Color(0.5, 0.5, 0.5);
    groundMaterial.gloss = 0.4;
    groundMaterial.metalness = 0.5;
    groundMaterial.useMetalness = true;
    groundMaterial.update();

    const ground = new pc.Entity();
    ground.addComponent('render', {
        type: 'box',
        material: groundMaterial
    });
    ground.setLocalScale(30, 1, 30);
    ground.setLocalPosition(0, -3, 0);
    app.root.addChild(ground);

    // light
    const directionalLight = new pc.Entity();
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        castShadows: true,
        shadowDistance: 20,
        intensity: 1,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shadowResolution: 2048
    });
    directionalLight.setEulerAngles(45, 180, 0);
    app.root.addChild(directionalLight);

    // Set an update function on the app's update event
    let time = 0;
    const rot = new pc.Quat();
    app.on('update', (/** @type {number} */ dt) => {
        time += dt;

        // rotate the boxes
        rot.setFromEulerAngles(20 * time, 30 * time, 0);
        boxes.forEach((box) => {
            box.setRotation(rot);
        });
    });
});

export { app };
