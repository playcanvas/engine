import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, glslangPath, twgslPath, scriptsPath }) {
    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.keyboard = new pc.Keyboard(window);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.ScriptHandler
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

    const assets = {
        script: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/fly-camera.js' })
    };

    /**
     * @param {pc.Asset[] | number[]} assetList - The asset list.
     * @param {pc.AssetRegistry} assetRegistry - The asset registry.
     * @returns {Promise<void>} The promise.
     */
    function loadAssets(assetList, assetRegistry) {
        return new Promise(resolve => {
            const assetListLoader = new pc.AssetListLoader(assetList, assetRegistry);
            assetListLoader.load(resolve);
        });
    }
    await loadAssets(Object.values(assets), app.assets);
    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);
    app.start();

    // ***********    Helper functions    *******************
    /**
     * @param {pc.Color} color - The color.
     * @returns {pc.StandardMaterial} The material.
     */
    function createMaterial(color) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        // we need to call material.update when we change its properties
        material.update();
        return material;
    }

    /**
     * @param {pc.Vec3} position - The position.
     * @param {pc.Vec3} size - The size.
     * @param {pc.Material} material - The material.
     */
    function createBox(position, size, material) {
        // create an entity and add a model component of type 'box'
        const box = new pc.Entity();
        box.addComponent("render", {
            type: "box",
            material: material
        });

        // move the box
        box.setLocalPosition(position);
        box.setLocalScale(size);

        // add the box to the hierarchy
        app.root.addChild(box);
    }

    // ***********    Create Boxes    *******************

    // create a few boxes in our scene
    const red = createMaterial(pc.Color.RED);
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
            createBox(new pc.Vec3(i * 2, 0, j * 4), pc.Vec3.ONE, red);
        }
    }

    // create a floor
    const white = createMaterial(pc.Color.WHITE);
    createBox(new pc.Vec3(0, -0.5, 0), new pc.Vec3(10, 0.1, 10), white);

    // ***********    Create lights   *******************

    // make our scene prettier by adding a directional light
    const light = new pc.Entity();
    light.addComponent("light", {
        type: "omni",
        color: new pc.Color(1, 1, 1),
        range: 100
    });
    light.setLocalPosition(0, 0, 2);

    // add the light to the hierarchy
    app.root.addChild(light);

    // ***********    Create camera    *******************

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent("camera", {
        clearColor: new pc.Color(0.5, 0.5, 0.8),
        nearClip: 0.3,
        farClip: 30
    });

    // add the fly camera script to the camera
    camera.addComponent("script");
    camera.script.create("flyCamera");

    // add the camera to the hierarchy
    app.root.addChild(camera);

    // Move the camera a little further away
    camera.translate(2, 0.8, 9);
    return app;
}

class FlyExample {
    static CATEGORY = 'Camera';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { FlyExample };
