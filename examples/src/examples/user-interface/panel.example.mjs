// 9-scaled image rendering, using an asset from https://help.umajin.com/nine-slice-tutorial/
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    grey_button: new pc.Asset('grey_button', 'texture', {
        url: `${rootPath}/static/assets/button/grey_button.png`
    }, { srgb: true })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler];

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

    // Create a camera
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
    });
    app.root.addChild(camera);

    // Create a 2D screen
    const screen = new pc.Entity();
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });
    app.root.addChild(screen);

    // Create a simple panel
    const panel = new pc.Entity();
    panel.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        width: 400,
        height: 200,
        pivot: [0.5, 0.5],
        type: pc.ELEMENTTYPE_IMAGE,
        useInput: true
    });
    screen.addChild(panel);

    // Prepare the atlas with a single frame
    const texture = assets.grey_button.resource;
    texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    texture.minFilter = pc.FILTER_NEAREST;
    texture.magFilter = pc.FILTER_NEAREST;

    const atlas = new pc.TextureAtlas();
    atlas.frames = {
        0: {
            // x, y, width, height properties of the frame in pixels
            rect: new pc.Vec4(0, 0, 240, 135),

            // The pivot of the frame - values are between 0-1
            pivot: new pc.Vec2(0.5, 0.5),

            // Nine-slice border: left, bottom, right, top border in pixels
            border: new pc.Vec4(21, 28, 21, 33)
        }
    };
    atlas.texture = texture;

    /**
     * @param {string} frame - Frame key for pc.Sprite.
     * @returns {pc.Asset} The asset.
     */
    const createSpriteAsset = function (frame) {
        const sprite = new pc.Sprite(app.graphicsDevice, {
            atlas: atlas,
            frameKeys: [frame],
            pixelsPerUnit: 1,
            renderMode: pc.SPRITE_RENDERMODE_SLICED
        });

        const spriteAsset = new pc.Asset('sprite', 'sprite', { url: '' });
        spriteAsset.resource = sprite;
        spriteAsset.loaded = true;
        app.assets.add(spriteAsset);
        return spriteAsset;
    };

    panel.element.spriteAsset = createSpriteAsset('0').id;

    // Animation variables
    let scaleXDirection = 1;
    let scaleYDirection = 1;
    const scaleXSpeed = 3;
    const scaleYSpeed = 1.5;

    app.on('update', (dt) => {
        const currentWidth = panel.element.width;
        const currentHeight = panel.element.height;

        let targetWidth = currentWidth + scaleXDirection * scaleXSpeed;
        let targetHeight = currentHeight + scaleYDirection * scaleYSpeed;

        // Bounce logic for width
        if (targetWidth > 800) {
            targetWidth = 800;
            scaleXDirection = -1;
        } else if (targetWidth < 100) {
            targetWidth = 100;
            scaleXDirection = 1;
        }

        // Bounce logic for height
        if (targetHeight > 676) {
            targetHeight = 676;
            scaleYDirection = -1;
        } else if (targetHeight < 100) {
            targetHeight = 100;
            scaleYDirection = 1;
        }

        panel.element.width = targetWidth;
        panel.element.height = targetHeight;
    });

    // apply UI changes
    data.on('*:set', (/** @type {string} */ path, value) => {
        if (path === 'data.sliced') {
            panel.element.sprite.renderMode = value ? pc.SPRITE_RENDERMODE_SLICED : pc.SPRITE_RENDERMODE_SIMPLE;
        }
    });

    // set initial values
    data.set('data', {
        sliced: true
    });
});

export { app };
