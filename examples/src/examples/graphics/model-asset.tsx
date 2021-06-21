import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class ModelAssetExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Model Asset';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { statue: pc.Asset }): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        app.start();

        // create an entity with render assets
        const entity = assets.statue.resource.instantiateModelEntity({
            castShadows: true
        });

        app.root.addChild(entity);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 7, 24);
        app.root.addChild(camera);

        // Create an Entity with a omni light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 100,
            castShadows: true
        });
        light.translate(5, 0, 15);
        app.root.addChild(light);

        app.on("update", function (dt) {
            if (entity) {
                entity.rotate(0, 10 * dt, 0);
            }
        });
    }
}

export default ModelAssetExample;
