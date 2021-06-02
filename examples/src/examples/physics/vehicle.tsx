import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class VehicleExample extends Example {
    static CATEGORY = 'Physics';
    static NAME = 'Vehicle';

    load() {
        return <>
            <AssetLoader name='script1' type='script' url='static/scripts/camera/tracking-camera.js' />
            <AssetLoader name='script2' type='script' url='static/scripts/physics/render-physics.js' />
            <AssetLoader name='script3' type='script' url='static/scripts/physics/action-physics-reset.js' />
            <AssetLoader name='script4' type='script' url='static/scripts/physics/vehicle.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { script1: pc.Asset, script2: pc.Asset, script3: pc.Asset, script4: pc.Asset }, wasmSupported: any, loadWasmModuleAsync: any): void {

        if (wasmSupported()) {
            loadWasmModuleAsync('Ammo', 'static/lib/ammo/ammo.wasm.js', 'static/lib/ammo/ammo.wasm.wasm', demo);
        } else {
            loadWasmModuleAsync('Ammo', 'static/lib/ammo/ammo.js', '', demo);
        }

        function demo() {
            // Create the application and start the update loop
            const app = new pc.Application(canvas, {
                keyboard: new pc.Keyboard(window)
            });
            app.start();

            // Create a static ground shape for our car to drive on
            const ground = new pc.Entity('Ground');
            ground.addComponent('rigidbody', {
                type: 'static'
            });
            ground.addComponent('collision', {
                type: 'box',
                halfExtents: new pc.Vec3(50, 0.5, 50)
            });
            ground.setLocalPosition(0, -0.5, 0);
            app.root.addChild(ground);

            // Create 4 wheels for our vehicle
            const wheels: any = [];
            [
                { name: 'Front Left Wheel', pos: new pc.Vec3(0.8, 0.4, 1.2), front: true },
                { name: 'Front Right Wheel', pos: new pc.Vec3(-0.8, 0.4, 1.2), front: true },
                { name: 'Back Left Wheel', pos: new pc.Vec3(0.8, 0.4, -1.2), front: false },
                { name: 'Back Right Wheel', pos: new pc.Vec3(-0.8, 0.4, -1.2), front: false }
            ].forEach(function (wheelDef) {
                // Create a wheel
                const wheel = new pc.Entity(wheelDef.name);
                wheel.addComponent('script');
                wheel.script.create('vehicleWheel', {
                    attributes: {
                        debugRender: true,
                        isFront: wheelDef.front
                    }
                });
                wheel.setLocalPosition(wheelDef.pos);
                wheels.push(wheel);
            });

            // Create a physical vehicle
            const vehicle = new pc.Entity('Vehicle');
            vehicle.addComponent('rigidbody', {
                mass: 800,
                type: 'dynamic'
            });
            vehicle.addComponent('collision', {
                type: 'compound'
            });
            vehicle.addComponent('script');
            vehicle.script.create('vehicle', {
                attributes: {
                    wheels: wheels
                }
            });
            vehicle.script.create('vehicleControls');
            vehicle.script.create('actionPhysicsReset', {
                attributes: {
                    event: 'reset'
                }
            });
            vehicle.setLocalPosition(0, 2, 0);

            // Create the car chassis, offset upwards in Y from the compound body
            const chassis = new pc.Entity('Chassis');
            chassis.addComponent('collision', {
                type: 'box',
                halfExtents: [0.6, 0.35, 1.65]
            });
            chassis.setLocalPosition(0, 0.65, 0);

            // Create the car chassis, offset upwards in Y from the compound body
            const cab = new pc.Entity('Cab');
            cab.addComponent('collision', {
                type: 'box',
                halfExtents: [0.5, 0.2, 1]
            });
            cab.setLocalPosition(0, 1.2, -0.25);

            // Add the vehicle to the hierarchy
            wheels.forEach(function (wheel: pc.Entity) {
                vehicle.addChild(wheel);
            });
            vehicle.addChild(chassis);
            vehicle.addChild(cab);
            app.root.addChild(vehicle);

            // Build a wall of blocks for the car to smash through
            for (let i = 0; i < 10; i++) {
                for (let j = 0; j < 5; j++) {
                    const block = new pc.Entity('Block');
                    block.addComponent('rigidbody', {
                        type: 'dynamic'
                    });
                    block.addComponent('collision', {
                        type: 'box'
                    });
                    block.addComponent('script');
                    block.script.create('actionPhysicsReset', {
                        attributes: {
                            event: 'reset'
                        }
                    });
                    block.setLocalPosition(i - 4.5, j + 0.5, -10);
                    app.root.addChild(block);
                }
            }

            // Create a directional light source
            const light = new pc.Entity('Directional Light');
            light.addComponent("light", {
                type: "directional",
                color: new pc.Color(1, 1, 1),
                castShadows: true,
                shadowBias: 0.2,
                shadowDistance: 40,
                normalOffsetBias: 0.05,
                shadowResolution: 2048
            });
            light.setLocalEulerAngles(45, 30, 0);
            app.root.addChild(light);

            // Create a camera to render the scene
            const camera = new pc.Entity('Camera');
            camera.addComponent("camera");
            camera.addComponent('script');
            camera.script.create('trackingCamera', {
                attributes: {
                    target: vehicle
                }
            });
            camera.translate(0, 10, 15);
            camera.lookAt(0, 0, 0);
            app.root.addChild(camera);

            // Enable rendering and resetting of all rigid bodies in the scene
            app.root.addComponent('script');
            app.root.script.create('renderPhysics', {
                attributes: {
                    drawShapes: true,
                    opacity: 1
                }
            });

            app.keyboard.on(pc.EVENT_KEYDOWN, function (e) {
                if (e.key === pc.KEY_R) {
                    app.fire('reset');
                }
            });
        }
    }
}

export default VehicleExample;
