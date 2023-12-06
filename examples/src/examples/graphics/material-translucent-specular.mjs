import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath }) {

    const assets = {
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        font: new pc.Asset('font', 'font', { url: assetPath + 'fonts/arial.json' })
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
        pc.LightComponentSystem,
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

        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.skyboxMip = 1;
        app.scene.skyboxIntensity = 1;

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera");
        camera.translate(0, 0, 8);
        camera.rotate(0, 0, 0);
        app.root.addChild(camera);

        // Create an entities with a directional light components
        for (let i = 0; i < 3; i++) {
            const light = new pc.Entity();
            light.addComponent("light", {
                type: "directional"
            });
            app.root.addChild(light);
            light.rotateLocal(60 + 10 * i, 30 + 90 * i, 0);
        }

        const NUM_SPHERES_X = 10;
        const NUM_SPHERES_Z = 5;
        /**
         * 
         * @param {number} x - The x coordinate.
         * @param {number} y - The y coordinate.
         * @param {number} z - The z coordinate.
         */
        const createSphere = function (x, y, z) {
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(0.7, 0.7, 0.7);
            material.specular = new pc.Color(1, 1, 1);
            material.metalness = 0.0;
            material.gloss = ((z) / (NUM_SPHERES_Z - 1) * 0.5) + 0.5;
            material.useMetalness = true;
            material.blendType = pc.BLEND_NORMAL;
            material.opacity = (x >= 5) ? ((x - 5) / 5 + 0.2) * ((x - 5) / 5 + 0.2) : (x / 5 + 0.2) * (x / 5 + 0.2);
            material.opacityFadesSpecular = !(x >= 5);
            material.alphaWrite = false;

            material.update();

            const sphere = new pc.Entity();

            sphere.addComponent("render", {
                material: material,
                type: "sphere"
            });
            sphere.setLocalPosition(x - (NUM_SPHERES_X - 1) * 0.5, z - (NUM_SPHERES_Z - 1) * 0.5, 0);
            sphere.setLocalScale(0.7, 0.7, 0.7);
            app.root.addChild(sphere);
        };
        /**
         * @param {pc.Asset} fontAsset - The font asset.
         * @param {string} message - The message.
         * @param {number} x - The x coordinate.
         * @param {number} y - The y coordinate.
         * @param {number} z - The z coordinate.
         * @param {number} rotx - Rotation around x coordinate (euler angles).
         * @param {number} roty - Rotation around y coordinate (euler angles).
         */
        const createText = function (fontAsset, message, x, y, z, rotx, roty) {
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
            text.setLocalEulerAngles(rotx, roty, 0);
            app.root.addChild(text);
        };

        for (let i = 0; i < NUM_SPHERES_Z; i++) {
            for (let j = 0; j < NUM_SPHERES_X; j++) {
                createSphere(j, 0, i);
            }
        }

        createText(assets.font, 'Spec Fade On', -NUM_SPHERES_X * 0.25, ((NUM_SPHERES_Z + 1) * -0.5), 0, -0, 0);
        createText(assets.font, 'Spec Fade Off', NUM_SPHERES_X * 0.25, ((NUM_SPHERES_Z + 1) * -0.5), 0, -0, 0);
    });
    return app;
}

export class MaterialTranslucentSpecularExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static example = example;
}
