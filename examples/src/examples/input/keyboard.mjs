import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath }) {

    const assets = {
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        statue: new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler
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

        // set skybox
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.exposure = 1.6;
        app.scene.skyboxMip = 1;

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 7, 25);
        app.root.addChild(camera);

        const entity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        const keyboard = new pc.Keyboard(document.body);
        app.on("update", function () {
            if (keyboard.isPressed(pc.KEY_LEFT)) {
                entity.rotate(0, -1, 0);
            }
            if (keyboard.isPressed(pc.KEY_RIGHT)) {
                entity.rotate(0, 1, 0);
            }
        });
    });
    return app;
}

class KeyboardExample {
    static CATEGORY = 'Input';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { KeyboardExample };
