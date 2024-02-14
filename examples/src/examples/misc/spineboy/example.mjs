import * as pc from 'playcanvas';
import { getDeviceType } from 'utils';

/**
 * @returns {Promise<pc.AppBase>} The example application.
 */
export async function example() {
    const canvas = document.getElementById("application-canvas");

    const assets = {
        skeleton   : new pc.Asset('skeleton'        , 'json'   , { url: '/static/assets//spine/spineboy-pro.json' }),
        atlas      : new pc.Asset('atlas'           , 'text'   , { url: '/static/assets//spine/spineboy-pro.atlas' }),
        texture    : new pc.Asset('spineboy-pro.png', 'texture', { url: '/static/assets//spine/spineboy-pro.png' }),
        spinescript: new pc.Asset('spinescript'     , 'script' , { url: '/static/scripts/spine/playcanvas-spine.3.8.js' }),
    };

    const gfxOptions = {
        deviceTypes: [getDeviceType()],
        glslangUrl: '/static/lib/glslang/glslang.js',
        twgslUrl: '/static/lib/twgsl/twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.CameraComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        pc.TextureHandler,
        pc.ScriptHandler,
        pc.JsonHandler,
        pc.TextHandler
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
    assetListLoader.load(async () => {

        app.start();

        //globalThis.pc = pc;
        //await import("/static/scripts/spine/playcanvas-spine.3.8.js");

        // create camera entity
        const camera = new pc.Entity('camera');
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.5, 0.6, 0.9)
        });
        app.root.addChild(camera);
        camera.translateLocal(0, 7, 20);
        /**
         * 
         * @param {pc.Vec3} position 
         * @param {pc.Vec3} scale 
         * @param {number} timeScale 
         */
        const createSpineInstance = (position, scale, timeScale) => {

            const spineEntity = new pc.Entity();
            spineEntity.addComponent("spine", {
                atlasAsset: assets.atlas.id,
                skeletonAsset: assets.skeleton.id,
                textureAssets: [assets.texture.id]
            });
            spineEntity.setLocalPosition(position);
            spineEntity.setLocalScale(scale);
            app.root.addChild(spineEntity);

            // play spine animation
            // @ts-ignore
            //debugger;
            spineEntity.spine.state.setAnimation(0, "portal", true);

            // @ts-ignore
            spineEntity.spine.state.timeScale = timeScale;
        };

        // create spine entity 1
        createSpineInstance(new pc.Vec3(2, 2, 0), new pc.Vec3(1, 1, 1), 1);

        // create spine entity 2
        createSpineInstance(new pc.Vec3(2, 10, 0), new pc.Vec3(-0.5, 0.5, 0.5), 0.5);
    });
    return app;
}
