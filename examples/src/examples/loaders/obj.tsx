import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class OBJExample extends Example {
    static CATEGORY = 'Loaders';
    static NAME = 'OBJ';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        const objurl = "static/assets/models/monkey.obj";
        const scripturl = "static/scripts/parsers/obj-model.js";

        let entity: pc.Entity;
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
                const mis = entity.model.model.meshInstances;
                for (let i = 0; i < mis.length; i++) {
                    mis[i].material = new pc.StandardMaterial();
                    // @ts-ignore engine-tsd
                    mis[i].material.diffuse = new pc.Color(pc.math.random(0, 1), pc.math.random(0, 1), pc.math.random(0, 1));
                    mis[i].material.update();
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
    }
}

export default OBJExample;
