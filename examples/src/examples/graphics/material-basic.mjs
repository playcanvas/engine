import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath }) {

    const assets = {
        'font': new pc.Asset('font', 'font', { url: assetPath + 'fonts/arial.json' }),
        'rocks': new pc.Asset("rocks", "texture", { url: assetPath + "textures/seaside-rocks01-diffuse-alpha.png" })
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
        pc.ElementComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
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

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1, 1)
        });
        camera.translate(2, 1, 8);
        camera.lookAt(new pc.Vec3(0, -0.3, 0));
        app.root.addChild(camera);

        const NUM_BOXES = 5;

        // alpha blend modes for individual rows
        const blendModes = [
            pc.BLEND_ADDITIVE,
            pc.BLEND_SUBTRACTIVE,
            pc.BLEND_SCREEN,
            pc.BLEND_NORMAL,
            pc.BLEND_NONE
        ];

        /**
         * @param {number} x - The x coordinate.
         * @param {number} y - The y coordinate.
         * @param {number} z - The z coordinate.
         * @returns {pc.Entity} The returned entity.
         */
        const createPrimitive = function (x, y, z) {

            // a basic material, which does not have support for lighting
            const material = new pc.BasicMaterial();

            // diffuse color
            material.color.set(x, y, 1 - y);

            // diffuse texture with alpha channel for transparency
            material.colorMap = assets.rocks.resource;

            // disable culling to see back faces as well
            material.cull = pc.CULLFACE_NONE;

            // set up alpha test value
            material.alphaTest = x / NUM_BOXES - 0.1;

            // alpha blend mode
            material.blendType = blendModes[y];

            const box = new pc.Entity();
            box.addComponent("render", {
                material: material,
                type: "box",

                // Note: basic material cannot currently cast shadows, disable it
                castShadows: false
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
            text.addComponent("element", {
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

        createText(assets.font, 'Alpha Test', 0, -(NUM_BOXES + 1) * 0.5, 0, 0);
        createText(assets.font, 'Alpha Blend', -(NUM_BOXES + 1) * 0.5, 0, 0, 90);

        // Set an update function on the app's update event
        let time = 0;
        const rot = new pc.Quat();
        app.on("update", function (/** @type {number} */dt) {
            time += dt;

            // rotate the boxes
            rot.setFromEulerAngles(20 * time, 30 * time, 0);
            boxes.forEach((box) => {
                box.setRotation(rot);
            });
        });
    });
    return app;
}

export class MaterialBasicExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static example = example;
}
