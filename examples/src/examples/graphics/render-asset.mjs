import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath }) {

    const assets = {
        'helipad': new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        'statue': new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' }),
        'cube': new pc.Asset('cube', 'container', { url: assetPath + 'models/playcanvas-cube.glb' })
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

        /** @type {pc.Entity[]} */
        const cubeEntities = [];

        // get the instance of the cube it set up with render component and add it to scene
        cubeEntities[0] = assets.cube.resource.instantiateRenderEntity();
        cubeEntities[0].setLocalPosition(7, 12, 0);
        cubeEntities[0].setLocalScale(3, 3, 3);
        app.root.addChild(cubeEntities[0]);

        // clone another copy of it and add it to scene
        cubeEntities[1] = cubeEntities[0].clone();
        cubeEntities[1].setLocalPosition(-7, 12, 0);
        cubeEntities[1].setLocalScale(3, 3, 3);
        app.root.addChild(cubeEntities[1]);

        // get the instance of the statue and set up with render component
        const statueEntity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(statueEntity);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.1, 0.1),
            farClip: 100
        });
        camera.translate(-20, 15, 20);
        camera.lookAt(0, 7, 0);
        app.root.addChild(camera);

        // set skybox
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;

        // spin the meshes
        app.on("update", function (dt) {

            if (cubeEntities[0]) {
                cubeEntities[0].rotate(3 * dt, 10 * dt, 6 * dt);
            }

            if (cubeEntities[1]) {
                cubeEntities[1].rotate(-7 * dt, 5 * dt, -2 * dt);
            }

            if (statueEntity) {
                statueEntity.rotate(0, -12 * dt, 0);
            }

        });
    });
    return app;
}

export class RenderAssetExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static example = example;
}
