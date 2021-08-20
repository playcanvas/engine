import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class PNGExample extends Example {
    static CATEGORY = 'Loaders';
    static NAME = 'PNG';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        const scriptUrl = 'static/scripts/parsers/upng.js';
        const textureUrl = 'static/assets/textures/lightmap.png';

        app.assets.loadFromUrl(scriptUrl, "script", function () {
            // register png parser
            // @ts-ignore
            app.loader.getHandler("texture").parsers.png = new PngParser(app.graphicsDevice);

            // load an rgbm lightmap
            app.assets.loadFromUrl(textureUrl, "texture", function (err, asset) {
                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.4, 0.45, 0.5)
                });
                camera.translate(0, 0, 2);
                app.root.addChild(camera);

                const texture = asset.resource;
                texture.type = pc.TEXTURETYPE_RGBM;

                const material = new pc.StandardMaterial();
                material.diffuse.set(0.4, 0.4, 0.4);
                material.lightMap = texture;
                material.lightMapUv = 0;
                material.update();

                const entity = new pc.Entity();
                entity.addComponent("render", {
                    type: "box",
                    material: material
                });
                app.root.addChild(entity);

                app.start();
            });
        });
    }
}

export default PNGExample;
