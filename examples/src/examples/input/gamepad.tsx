import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class GamepadExample extends Example {
    static CATEGORY = 'Input';
    static NAME = 'Gamepad';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { statue: pc.Asset }): void {
        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 7, 25);
        app.root.addChild(camera);

        // Create an Entity with a omni light component and a sphere model component.
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 100
        });
        light.translate(5, 5, 10);
        app.root.addChild(light);

        const entity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        const gamepads = new pc.GamePads();
        app.on("update", function () {
            gamepads.update();
            if (gamepads.isPressed(pc.PAD_1, pc.PAD_LEFT)) {
                entity.rotate(0, -1, 0);
            }
            if (gamepads.isPressed(pc.PAD_1, pc.PAD_RIGHT)) {
                entity.rotate(0, 1, 0);
            }
            if (gamepads.wasPressed(pc.PAD_1, pc.PAD_UP)) {
                entity.rotate(-1, 0, 0);
            }
            if (gamepads.wasPressed(pc.PAD_1, pc.PAD_DOWN)) {
                entity.rotate(1, 0, 0);
            }
        });
    }
}

export default GamepadExample;
