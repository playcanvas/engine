import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class ModelTexturedBoxExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Model Textured Box';

    load() {
        return <>
            <AssetLoader name='clouds' type='texture' url='static/assets/textures/clouds.jpg' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { clouds: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create a Entity with a Box model component
        const box = new pc.Entity();
        box.addComponent("model", {
            type: "box"
        });

        // Create an Entity with a omni light component and a sphere model component.
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 0, 0),
            radius: 10
        });
        light.addComponent("model", {
            type: "sphere"
        });
        // Scale the sphere down to 0.1m
        light.setLocalScale(0.1, 0.1, 0.1);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });

        // Add the new Entities to the hierarchy
        app.root.addChild(box);
        app.root.addChild(light);
        app.root.addChild(camera);

        // Move the camera 10m along the z-axis
        camera.translate(0, 0, 10);

        // Set an update function on the app's update event
        let angle = 0;
        app.on("update", function (dt) {
            angle += dt;
            if (angle > 360) {
                angle = 0;
            }

            // Move the light in a circle
            light.setLocalPosition(3 * Math.sin(angle), 0, 3 * Math.cos(angle));

            // Rotate the box
            box.setEulerAngles(angle * 2, angle * 4, angle * 8);
        });

        const material = new pc.StandardMaterial();
        material.diffuseMap = assets.clouds.resource;
        material.update();

        box.model.material = material;
    }
}

export default ModelTexturedBoxExample;
