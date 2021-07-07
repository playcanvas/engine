import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class BatchingDynamicExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Batching Dynamic';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        // create two material
        const material1 = new pc.StandardMaterial();
        material1.diffuse = new pc.Color(1, 1, 0);
        material1.shininess = 40;
        material1.metalness = 0.5;
        material1.useMetalness = true;
        material1.update();

        const material2 = new pc.StandardMaterial();
        material2.diffuse = new pc.Color(0, 1, 1);
        material2.shininess = 40;
        material2.metalness = 0.5;
        material2.useMetalness = true;
        material2.update();

        // create a single BatchGroup. Make it dynamic to allow batched meshes to be freely moved every frame.
        const batchGroup = app.batcher.addGroup("Meshes", true, 100);

        // create constious primitive instances using one of the two materials
        const numInstances = 500;
        const shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
        const entities: any = [];
        for (let i = 0; i < numInstances; i++) {

            // random shape
            const shapeName = shapes[Math.floor(Math.random() * shapes.length)];

            const entity = new pc.Entity();

            // create render component
            entity.addComponent("render", {
                type: shapeName,
                material: Math.random() < 0.5 ? material1 : material2,
                castShadows: true,

                // add it to the batchGroup - this instructs engine to try and render these meshes in a small number of draw calls.
                // there will be at least 2 draw calls, one for each material
                batchGroupId: batchGroup.id
            });

            // add entity for rendering
            app.root.addChild(entity);

            // keep in the list to adjust positions each frame
            entities.push(entity);
        }

        // Create an Entity for the ground
        const ground = new pc.Entity();
        ground.addComponent("render", {
            type: "box",
            material: material2
        });
        ground.setLocalScale(150, 1, 150);
        ground.setLocalPosition(0, -26, 0);
        app.root.addChild(ground);

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });
        app.root.addChild(camera);

        // Create an entity with a directional light component
        // Add it as a child of a camera to rotate with the camera
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.06,
            shadowDistance: 150
        });
        camera.addChild(light);
        light.setLocalEulerAngles(15, 30, 0);

        // Set an update function on the app's update event
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // move all entities along orbits
            for (let i = 0; i < entities.length; i++) {
                const radius = 5 + 20.0 * i / numInstances;
                const speed = i / numInstances;
                entities[i].setLocalPosition(radius * Math.sin(i + time * speed), radius * Math.cos(i + time * speed), radius * Math.cos(i + 2 * time * speed));
                entities[i].lookAt(pc.Vec3.ZERO);
            }

            // orbit camera around
            camera.setLocalPosition(70 * Math.sin(time), 0, 70 * Math.cos(time));
            camera.lookAt(pc.Vec3.ZERO);
        });
    }
}

export default BatchingDynamicExample;
