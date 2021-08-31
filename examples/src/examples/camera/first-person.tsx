import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class FirstPersonExample extends Example {
    static CATEGORY = 'Camera';
    static NAME = 'First Person';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='script' type='script' url='static/scripts/camera/first-person-camera.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { statue: pc.Asset, script: pc.Asset }, wasmSupported: any, loadWasmModuleAsync: any): void {

        if (wasmSupported()) {
            loadWasmModuleAsync('Ammo', 'static/lib/ammo/ammo.wasm.js', 'static/lib/ammo/ammo.wasm.wasm', run);
        } else {
            loadWasmModuleAsync('Ammo', 'static/lib/ammo/ammo.js', '', run);
        }

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            gamepads: new pc.GamePads(),
            keyboard: new pc.Keyboard(window)
        });

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);
        function run() {
            app.start();

            // Create a physical floor
            const floor = new pc.Entity();
            floor.addComponent("collision", {
                type: "box",
                halfExtents: new pc.Vec3(100, 0.5, 100)
            });
            floor.addComponent("rigidbody", {
                type: "static",
                restitution: 0.5
            });
            floor.setLocalPosition(0, -0.5, 0);
            app.root.addChild(floor);

            const floorModel = new pc.Entity();
            floorModel.addComponent("model", {
                type: "plane"
            });
            floorModel.setLocalPosition(0, 0.5, 0);
            floorModel.setLocalScale(200, 1, 200);
            floor.addChild(floorModel);

            // Create a model entity and assign the statue model
            const model = assets.statue.resource.instantiateRenderEntity({
                castShadows: true
            });
            model.addComponent("collision", {
                type: "mesh",
                asset: assets.statue.resource.model
            });
            model.addComponent("rigidbody", {
                type: "static",
                restitution: 0.5
            });
            app.root.addChild(model);

            // Create a camera that will be driven by the character controller
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.4, 0.45, 0.5),
                farClip: 100,
                fov: 65,
                nearClip: 0.1
            });
            camera.setLocalPosition(0, 1, 0);

            // Create a physical character controller
            const characterController = new pc.Entity();
            characterController.addComponent("collision", {
                axis: 0,
                height: 2,
                radius: 0.5,
                type: "capsule"
            });
            characterController.addComponent("rigidbody", {
                angularDamping: 0,
                angularFactor: pc.Vec3.ZERO,
                friction: 0.3,
                linearDamping: 0,
                linearFactor: pc.Vec3.ONE,
                mass: 80,
                restitution: 0,
                type: "dynamic"
            });
            characterController.addComponent("script");
            characterController.script.create("characterController");
            characterController.script.create("firstPersonCamera", {
                attributes: {
                    camera: camera
                }
            });
            characterController.script.create("gamePadInput");
            characterController.script.create("keyboardInput");
            characterController.script.create("mouseInput");
            characterController.script.create("touchInput");
            characterController.setLocalPosition(0, 1, 10);

            // Add the character controll and camera to the hierarchy
            app.root.addChild(characterController);
            characterController.addChild(camera);

            // Create a directional light
            const light = new pc.Entity();
            light.addComponent("light", {
                castShadows: true,
                color: new pc.Color(1, 1, 1),
                normalOffsetBias: 0.05,
                shadowBias: 0.2,
                shadowDistance: 40,
                type: "directional",
                shadowResolution: 2048
            });
            app.root.addChild(light);
            light.setLocalEulerAngles(45, 30, 0);
        }
    }
}

export default FirstPersonExample;
