import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath }) {

    const assets = {
        'statue': new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' })
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
        pc.ModelComponentSystem,
        pc.CameraComponentSystem,
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

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // create an entity with render assets
        const entity = assets.statue.resource.instantiateModelEntity({
            castShadows: true
        });

        app.root.addChild(entity);

        // clone a small version of the entity
        const clone = entity.clone();
        clone.setLocalScale(0.2, 0.2, 0.2);
        clone.setLocalPosition(-4, 12, 0);
        app.root.addChild(clone);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 7, 24);
        app.root.addChild(camera);

        // Create an Entity with a omni light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 100,
            castShadows: true
        });
        light.translate(5, 0, 15);
        app.root.addChild(light);

        app.on("update", function (dt) {
            if (entity) {
                entity.rotate(0, 10 * dt, 0);
            }
        });
    });
    return app;
}

export class ModelAssetExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static example = example;
}
