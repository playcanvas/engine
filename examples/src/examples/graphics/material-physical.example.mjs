import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/arial.json' })
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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.ElementComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler];

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

    app.scene.envAtlas = assets.helipad.resource;
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxMip = 1;

    // Create an entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera');
    camera.translate(0, 0, 9);
    app.root.addChild(camera);

    const NUM_SPHERES = 5;
    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     */
    const createSphere = function (x, y, z) {
        const material = new pc.StandardMaterial();
        material.metalness = y / (NUM_SPHERES - 1);
        material.gloss = x / (NUM_SPHERES - 1);
        material.useMetalness = true;
        material.update();

        const sphere = new pc.Entity();
        sphere.addComponent('render', {
            material: material,
            type: 'sphere'
        });
        sphere.setLocalPosition(x - (NUM_SPHERES - 1) * 0.5, y - (NUM_SPHERES - 1) * 0.5, z);
        sphere.setLocalScale(0.9, 0.9, 0.9);
        app.root.addChild(sphere);
    };

    /**
     * @param {pc.Asset} fontAsset - The font asset.
     * @param {string} message - The message.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} rot - Euler rotation around z coordinate.
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

    for (let i = 0; i < NUM_SPHERES; i++) {
        for (let j = 0; j < NUM_SPHERES; j++) {
            createSphere(j, i, 0);
        }
    }

    createText(assets.font, 'Glossiness', 0, -(NUM_SPHERES + 1) * 0.5, 0, 0);
    createText(assets.font, 'Metalness', -(NUM_SPHERES + 1) * 0.5, 0, 0, 90);

    // rotate the skybox using mouse input
    const mouse = new pc.Mouse(document.body);

    let x = 0;
    let y = 0;
    const rot = new pc.Quat();

    mouse.on('mousemove', function (event) {
        if (event.buttons[pc.MOUSEBUTTON_LEFT]) {
            x += event.dx;
            y += event.dy;

            rot.setFromEulerAngles(0.2 * y, 0.2 * x, 0);
            app.scene.skyboxRotation = rot;
        }
    });
    app.on('destroy', () => mouse.detach());
});

export { app };
