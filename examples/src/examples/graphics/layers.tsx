import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class LayersExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Layers';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create a new layer to put in front of everything
        const layer = new pc.Layer({
            name: "Front Layer"
        });

        // get the world layer index
        const worldLayer = app.scene.layers.getLayerByName("World");
        const idx = app.scene.layers.getTransparentIndex(worldLayer);

        // insert the new layer after the world layer
        app.scene.layers.insert(layer, idx + 1);

        // Create an Entity with a camera component
        // Make sure it renders both World and Front Layer
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            layers: [worldLayer.id, layer.id]
        });
        camera.translate(0, 0, 24);
        app.root.addChild(camera);

        // Create an Entity with a omni light component
        // Make sure it lights both World and Front Layer
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 100,
            layers: [worldLayer.id, layer.id]
        });
        light.translate(5, 0, 15);
        app.root.addChild(light);

        // red material is semi-transparent
        const red = new pc.StandardMaterial();
        red.diffuse.set(1, 0, 0);
        red.blendType = pc.BLEND_NORMAL;
        red.opacity = 0.5;
        red.update();

        // blue material does not test the existing depth buffer
        const blue = new pc.StandardMaterial();
        blue.diffuse.set(0, 0, 1);
        blue.depthTest = false;
        blue.update();

        // red box is rendered first in World layer
        const redBox = new pc.Entity();
        redBox.addComponent('model', {
            type: 'box'
        });
        redBox.model.material = red;
        redBox.setLocalScale(5, 5, 5);
        app.root.addChild(redBox);

        // blue box is rendered in the Front Layer which is after World
        // because it does not test for depth
        // and is in a later layer
        // it is visible even though it should be inside the red box
        const blueBox = new pc.Entity();
        blueBox.addComponent('model', {
            type: 'box',
            layers: [layer.id] // try removing this line, the blue box will appear inside the red one
        });
        blueBox.model.material = blue;
        blueBox.setLocalScale(2.5, 2.5, 2.5);
        app.root.addChild(blueBox);

        app.on("update", function (dt) {
            if (redBox) {
                redBox.rotate(0, 10 * dt, 0);
            }
            if (blueBox) {
                blueBox.rotate(0, -10 * dt, 0);
            }

            // @ts-ignore engine-tsd
            blueBox.model.meshInstances[0].layer = 10;
        });
    }
}

export default LayersExample;
