import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, glslangPath, twgslPath }) {
    // define script component
    class Rotator extends pc.ScriptType {
        // name of a script
        static name = 'rotator';

        // property
        speed = 42;

        // this method is executed once the object and script becomes
        // available for the execution (enabled)
        initialize() {
            this.entity.rotate(Math.random() * 360, Math.random() * 360, Math.random() * 360);
        }

        // this method is executed on every frame
        update(dt) {
            this.entity.rotate(dt * this.speed, 0, 0);
        }
    }

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
        pc.ScriptComponentSystem
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);
    app.start();

    // add script to script registry
    app.scripts.add(Rotator);

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // create box entity
    const box = new pc.Entity('cube');
    box.addComponent('render', {
        type: 'box'
    });
    // add script component
    box.addComponent('script');
    // add rotator script to the entity
    box.script?.create('rotator');

    // clone box multiple times
    // arranged in a circle
    for(let i = 0; i < 16; i++) {
        const entity = box.clone();
        const x = Math.sin(Math.PI * 2 * (i / 16));
        const y = Math.cos(Math.PI * 2 * (i / 16));
        entity.setLocalPosition(x * 2, y * 2, 0);
        app.root.addChild(entity);
    }

    // create camera entity
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9)
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 10);

    // create directional light entity
    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 0, 0);

    return app;
}

class ScriptsExample {
    static CATEGORY = 'Misc';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { ScriptsExample };
