import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, glslangPath, twgslPath, dracoPath }) {

    pc.WasmModule.setConfig('DracoDecoderModule', {
        glueUrl:     dracoPath + 'draco.wasm.js',
        wasmUrl:     dracoPath + 'draco.wasm.wasm',
        fallbackUrl: dracoPath + 'draco.js'
    });

    await new Promise((resolve) => { pc.WasmModule.getInstance('DracoDecoderModule', () => resolve()) });

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.touch = new pc.TouchDevice(document.body);
    createOptions.keyboard = new pc.Keyboard(document.body);
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        // @ts-ignore
        pc.EsmScriptComponentSystem,
        // @ts-ignore
        pc.RenderComponentSystem,
        // @ts-ignore
        pc.CameraComponentSystem,
        // @ts-ignore
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
    app.start();

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9),
        farClip: 10000
    });
    camera.addComponent('esmscript', {
        enabled: true,
        modules: [{
            moduleSpecifier: '/scripts/fly-camera.js',
            attributes: {
                camera,
                speed: 10,
                fastSpeed: 200
            }
        }]
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 3);

    // create box entity
    const box = new pc.Entity('World');
    box.addComponent('render', {
        type: 'box'
    });

    box.addComponent('esmscript', {
        enabled: true,
        modules: [
            {
                moduleSpecifier: '/scripts/earthtile.js',
                attributes: {
                    camera,
                    apiUrl: 'https://tile.googleapis.com/'
                }
            },
            {
                moduleSpecifier: '/scripts/geolocation.js',
                attributes: { camera }
            }
        ]
    });
    app.root.addChild(box);


    // create directional light entity
    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 0, 0);

    return app;
}

class EarthatileExample {
    static CATEGORY = 'Misc';
    static NAME = 'Hello Script Modules';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { EarthatileExample };
