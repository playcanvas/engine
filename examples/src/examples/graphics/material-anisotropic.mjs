import * as pc from 'playcanvas';
import { assetPath } from '../../assetPath.mjs';
import { enableHotReload } from '../../enableHotReload.mjs';

enableHotReload({
    assetPath,
});

/**
 * @param {HTMLCanvasElement} canvas - todo
 * @param {string} deviceType - todo
 * @returns {Promise<pc.AppBase>} todo
 */
async function example(canvas, deviceType) {

    const assets = {
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        'font': new pc.Asset('font', 'font', { url: assetPath + 'fonts/arial.json' })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: '/static/lib/glslang/glslang.js',
        twgslUrl: '/static/lib/twgsl/twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.touch = new pc.TouchDevice(document.body);

    createOptions.componentSystems = [
        // @ts-ignore
        pc.RenderComponentSystem,
        // @ts-ignore
        pc.CameraComponentSystem,
        // @ts-ignore
        pc.LightComponentSystem,
        // @ts-ignore
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

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;
        app.scene.envAtlas = assets.helipad.resource;

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera");
        camera.translate(0, 6, 6);
        camera.rotate(-48, 0, 0);
        app.root.addChild(camera);

        // Create an entity with a directional light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional"
        });
        app.root.addChild(light);
        const e = light.getLocalEulerAngles();
        light.setLocalEulerAngles(e.x + 90, e.y - 75, e.z);

        const NUM_SPHERES_X = 11;
        const NUM_SPHERES_Z = 6;
        /**
         * 
         * @param {number} x - todo
         * @param {number} y - todo
         * @param {number} z - todo
         */
        const createSphere = function (x, y, z) {
            const material = new pc.StandardMaterial();
            material.metalness = 1.0;
            material.gloss = z / (NUM_SPHERES_Z - 1);
            material.useMetalness = true;
            material.anisotropy = ((2 * x / (NUM_SPHERES_X - 1)) - 1.0) * -1.0;
            material.enableGGXSpecular = true;
            material.update();

            const sphere = new pc.Entity();

            sphere.addComponent("render", {
                material: material,
                type: "sphere"
            });
            sphere.setLocalPosition(x - (NUM_SPHERES_X - 1) * 0.5, y, z - (NUM_SPHERES_Z - 1) * 0.5);
            sphere.setLocalScale(0.7, 0.7, 0.7);
            app.root.addChild(sphere);
        };
        /**
         * @param {pc.Asset} fontAsset - todo
         * @param {string} message - todo
         * @param {number} x - todo
         * @param {number} y - todo
         * @param {number} z - todo
         * @param {number} rotx - todo
         * @param {number} roty - todo
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

        createText(assets.font, 'Anisotropy', 0, 0, ((NUM_SPHERES_Z + 1) * 0.5), -90, 0);
        createText(assets.font, 'Roughness', -(NUM_SPHERES_X + 1) * 0.5, 0, 0, -90, 90);
    });
    return app;
}

export class MaterialAnisotropicExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Material Anisotropic';
    static WEBGPU_ENABLED = true;
    static example = example;
}