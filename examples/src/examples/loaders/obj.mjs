import * as pc from 'playcanvas';

/**
 * @typedef {import('../../options.mjs').ExampleOptions} ExampleOptions
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, assetPath, scriptsPath }) {
    // Create the app and start the update loop
    const app = new pc.Application(canvas, {});

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

    const objurl = assetPath + 'models/monkey.obj';
    const scripturl = scriptsPath + 'parsers/obj-model.js';
    /** @type {pc.Entity} */
    let entity;
    app.assets.loadFromUrl(scripturl, "script", function () {

        // OBJ Parser is not enabled by default in engine. Add the parser to the model resource handler
        // set up obj parser
        // @ts-ignore globally loaded ObjModelParser
        app.loader.getHandler("model").addParser(new ObjModelParser(app.graphicsDevice), function (url) {
            return (pc.path.getExtension(url) === '.obj');
        });

        app.assets.loadFromUrl(objurl, "model", function (err, asset) {

            app.start();

            entity = new pc.Entity();
            entity.addComponent("model");
            entity.model.model = asset.resource;
            app.root.addChild(entity);

            // add a randomly generated material to all mesh instances
            const mis = entity.model.meshInstances;
            for (let i = 0; i < mis.length; i++) {
                const material = new pc.StandardMaterial();
                material.diffuse = new pc.Color(pc.math.random(0, 1), pc.math.random(0, 1), pc.math.random(0, 1));
                material.update();
                mis[i].material = material;
            }
        });
    });

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent("camera", {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });
    camera.translate(0, 0, 5);
    app.root.addChild(camera);

    // Create an Entity with a omni light component
    const light = new pc.Entity();
    light.addComponent("light", {
        type: "omni",
        color: new pc.Color(1, 1, 1),
        range: 100
    });
    light.translate(5, 0, 15);
    app.root.addChild(light);

    app.on("update", function (dt) {
        if (entity) {
            entity.rotate(0, 100 * dt, 0);
        }
    });
    return app;
}

export class ObjExample {
    static CATEGORY = 'Loaders';
    static example = example;
}
