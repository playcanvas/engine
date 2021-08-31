import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class ShapesExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Shapes';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});

        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // All render component primitive shape types
        const shapes = ["box", "plane", "cone", "cylinder", "sphere", "capsule"];
        let x = -1, y = -1;

        shapes.forEach(function (shape) {
            // Create an entity with a render component
            const entity = new pc.Entity();
            entity.addComponent("render", {
                type: shape
            });
            app.root.addChild(entity);

            // Lay out the 6 primitives in two rows, 3 per row
            entity.setLocalPosition(x * 1.2, y, 0);
            if (x++ === 1) {
                x = -1;
                y = 1;
            }
        });

        // Create an entity with a directional light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional"
        });
        app.root.addChild(light);
        light.setLocalEulerAngles(45, 30, 0);

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        app.root.addChild(camera);
        camera.setLocalPosition(0, 0, 5);
    }
}

export default ShapesExample;
