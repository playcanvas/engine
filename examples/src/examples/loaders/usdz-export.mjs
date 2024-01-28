import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { Button } = ReactPCUI;
    return jsx(Button, {
        text: 'Download USDZ',
        onClick: () => observer.emit('download'),
    });
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath, data, pcx }) {

    const assets = {
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        bench: new pc.Asset('bench', 'container', { url: assetPath + 'models/bench_wooden_01.glb' })
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


        // get the instance of the bench and set up with render component
        const entity = assets.bench.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.1, 0.1),
            farClip: 100
        });
        camera.translate(-3, 1, 2);
        camera.lookAt(0, 0.5, 0);
        app.root.addChild(camera);

        // set skybox
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;

        // a link element, created in the html part of the examples.
        const link = document.getElementById('ar-link');

        // convert the loaded entity into asdz file
        const options = {
            maxTextureSize: 1024
        };

        new pcx.UsdzExporter().build(entity, options).then((arrayBuffer) => {
            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });

            // On iPhone Safari, this link creates a clickable AR link on the screen. When this is clicked,
            // the download of the .asdz file triggers its opening in QuickLook AT mode.
            // In other browsers, this simply downloads the generated .asdz file.

            // @ts-ignore
            link.download = "bench.usdz";

            // @ts-ignore
            link.href = URL.createObjectURL(blob);
        }).catch(console.error);

        // when clicking on the download UI button, trigger the download
        data.on('download', function () {
            link.click();
        });

        // spin the meshe
        app.on("update", function (dt) {
            if (entity) {
                entity.rotate(0, -12 * dt, 0);
            }
        });
    });
    return app;
}

export class UsdzExportExample {
    static CATEGORY = 'Loaders';
    static WEBGPU_ENABLED = true;
    static INCLUDE_AR_LINK = true;
    static controls = controls;
    static example = example;
}
