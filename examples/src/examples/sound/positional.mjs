import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, glslangPath, twgslPath, assetPath }) {
    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.soundManager = new pc.SoundManager();

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.SoundComponentSystem,
        pc.AnimationComponentSystem,
        pc.AnimComponentSystem,
        pc.ModelComponentSystem,
        pc.AudioListenerComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.AudioHandler,
        // @ts-ignore
        pc.JsonHandler,
        // @ts-ignore
        pc.AnimationHandler,
        // @ts-ignore
        pc.ModelHandler,
        // @ts-ignore
        pc.MaterialHandler
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
        model: new pc.Asset('model', 'model', { url: assetPath + 'models/playbot/playbot.json' }),
        runAnim: new pc.Asset('runAnim', 'animation', { url: assetPath + 'animations/playbot/playbot-run.json' }),
        gravel: new pc.Asset('gravel', 'audio', { url: assetPath + 'sounds/footsteps.mp3' })
    };

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(1, 0, 0)
        });
        camera.addComponent("audiolistener");
        camera.rotateLocal(-30, 0, 0);
        camera.translateLocal(0, 0, 5);
        app.root.addChild(camera);

        // Create an Entity for the ground
        const material = new pc.StandardMaterial();
        material.diffuse = pc.Color.GRAY;
        material.update();

        const ground = new pc.Entity();
        ground.addComponent("render", {
            type: "box",
            material: material
        });
        ground.setLocalScale(50, 1, 50);
        ground.setLocalPosition(0, -0.5, 0);
        app.root.addChild(ground);

        // Create an entity with a light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: new pc.Color(1, 1, 1),
            castShadows: true,
            intensity: 2,
            shadowBias: 0.2,
            shadowDistance: 16,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        light.setLocalEulerAngles(45, 30, 0);
        app.root.addChild(light);

        app.start();

        // Create walking dude
        const entity = new pc.Entity();

        // add sound component
        entity.addComponent('sound');

        // add footsteps slot
        entity.sound.addSlot('footsteps', {
            asset: assets.gravel.id,
            pitch: 1.7,
            loop: true,
            autoPlay: true
        });

        // add model
        entity.addComponent("model", {
            type: "asset",
            asset: assets.model,
            castShadows: true
        });

        // add animation
        entity.addComponent("animation", {
            assets: [assets.runAnim],
            speed: 0.8
        });

        // add entity in the hierarchy
        app.root.addChild(entity);

        let angle = 135;
        const radius = 3;
        const height = 0;// 1.1;
        app.on("update", function (dt) {
            angle += 30 * dt;
            if (angle > 360) {
                angle -= 360;
            }
            entity.setLocalPosition(radius * Math.sin(angle * pc.math.DEG_TO_RAD), height, radius * Math.cos(angle * pc.math.DEG_TO_RAD));
            entity.setLocalEulerAngles(0, angle + 90, 0);
        });
    });
    return app;
}

class PositionalExample {
    static CATEGORY = 'Sound';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { PositionalExample };
