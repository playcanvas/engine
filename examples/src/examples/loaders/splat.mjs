import * as pc from 'playcanvas';

/**
 * @typedef {import('../../options.mjs').ExampleOptions} ExampleOptions
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath, dracoPath, pcx }) {

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        // @ts-ignore
        pc.RenderComponentSystem,
        // @ts-ignore
        pc.CameraComponentSystem,
        // @ts-ignore
        pc.LightComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);

    pcx.registerPlyParser(app);

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    const assets = {
        splat: new pc.Asset('splat', 'container', { url: assetPath + 'splats/guitar.ply' })
    };

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        console.log("loadded", assets);

        app.start();

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });
        camera.setLocalPosition(4, 1, 4);
        camera.lookAt(pc.Vec3.ZERO);
        app.root.addChild(camera);

        const entity = assets.splat.resource.instantiateRenderEntity({
            // temp hack for GS
            app: app,
            camera: camera,
            //onChanged: () => this.renderNextFrame()
        });
        app.root.addChild(entity);

        app.on("update", function (dt) {
            if (entity) {
                entity.rotate(0, -20 * dt, 0);
            }
        });
    });
    return app;
}

export class SplatExample {
    static CATEGORY = 'Loaders';
    static NAME = 'Splat';
    static example = example;
}
