import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath }) {

    // The example demonstrates loading of glb file, which contains meshes,
    // lights and cameras, and switches between the cameras every 2 seconds.

    const assets = {
        scene: new pc.Asset('scene', 'container', { url: assetPath + 'models/geometry-camera-light.glb' })
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

        /**
         * the array will store loaded cameras
         * @type {pc.CameraComponent[]}
         */
        let camerasComponents = null;

        // glb lights use physical units
        app.scene.physicalUnits = true;

        // create an instance using render component
        const entity = assets.scene.resource.instantiateRenderEntity({
        });
        app.root.addChild(entity);

        // find all cameras - by default they are disabled
        camerasComponents = entity.findComponents("camera");
        camerasComponents.forEach((component) => {

            // set the aspect ratio to automatic to work with any window size
            component.aspectRatioMode = pc.ASPECT_AUTO;

            // set up exposure for physical units
            component.aperture = 4;
            component.shutter = 1 / 100;
            component.sensitivity = 500;
        });

        /** @type {pc.LightComponent[]} */
        const lightComponents = entity.findComponents("light");
        // enable all lights from the glb
        lightComponents.forEach((component) => {
            component.enabled = true;
        });

        let time = 0;
        let activeCamera = 0;
        app.on("update", function (dt) {
            time -= dt;

            // change the camera every few seconds
            if (time <= 0) {
                time = 2;

                // disable current camera
                camerasComponents[activeCamera].enabled = false;

                // activate next camera
                activeCamera = (activeCamera + 1) % camerasComponents.length;
                camerasComponents[activeCamera].enabled = true;
            }
        });
    });
    return app;
}

class GlbExample {
    static CATEGORY = 'Loaders';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export {
    GlbExample,
};
