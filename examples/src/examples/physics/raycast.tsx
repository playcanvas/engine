import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class RaycastExample extends Example {
    static CATEGORY = 'Physics';
    static NAME = 'Raycast';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { font: pc.Asset }, wasmSupported: any, loadWasmModuleAsync: any): void {

        if (wasmSupported()) {
            loadWasmModuleAsync('Ammo', 'static/lib/ammo/ammo.wasm.js', 'static/lib/ammo/ammo.wasm.wasm', demo);
        } else {
            loadWasmModuleAsync('Ammo', 'static/lib/ammo/ammo.js', '', demo);
        }

        function demo() {
            // Create the application and start the update loop
            const app = new pc.Application(canvas, {});
            app.start();

            app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

            function createMaterial(color: pc.Color) {
                const material = new pc.StandardMaterial();
                material.diffuse = color;
                material.update();

                return material;
            }

            // Create a couple of materials
            const red = createMaterial(new pc.Color(1, 0, 0));
            const green = createMaterial(new pc.Color(0, 1, 0));

            // Create light
            const light = new pc.Entity();
            light.addComponent("light", {
                type: "directional"
            });

            app.root.addChild(light);
            light.setEulerAngles(45, 30, 0);

            // Create camera
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.5, 0.5, 0.8)
            });

            app.root.addChild(camera);
            camera.setPosition(5, 0, 15);

            function createPhysicalShape(type: string, material: pc.Material, x: number, y: number, z: number) {
                const e = new pc.Entity();

                // Have to set the position of the entity before adding the static rigidbody
                // component because static bodies cannot be moved after creation
                app.root.addChild(e);
                e.setPosition(x, y, z);

                e.addComponent("render", {
                    type: type,
                    material: material
                });
                e.addComponent("rigidbody", {
                    type: "static"
                });
                e.addComponent("collision", {
                    type: type,
                    height: type === 'capsule' ? 2 : 1
                });

                return e;
            }

            // Create two rows of physical geometric shapes
            const types = ['box', 'capsule', 'cone', 'cylinder', 'sphere'];
            types.forEach(function (type, idx) {
                createPhysicalShape(type, green, idx * 2 + 1, 2, 0);
            });
            types.forEach(function (type, idx) {
                createPhysicalShape(type, green, idx * 2 + 1, -2, 0);
            });

            // Allocate some colors
            const white = new pc.Color(1, 1, 1);
            const blue = new pc.Color(0, 0, 1);

            // Allocate some vectors
            const start = new pc.Vec3();
            const end = new pc.Vec3();
            const temp = new pc.Vec3();

            // Set an update function on the application's update event
            let time = 0;
            let y = 0;
            app.on("update", function (dt) {
                time += dt;

                // Reset all shapes to green
                app.root.findComponents('render').forEach(function (render: pc.RenderComponent) {
                    render.material = green;
                });

                y = 2 + 1.2 * Math.sin(time);
                start.set(0, y, 0);
                end.set(10, y, 0);

                // Render the ray used in the raycast
                app.renderLine(start, end, white);

                // @ts-ignore engine-tsd
                const result = app.systems.rigidbody.raycastFirst(start, end);
                if (result) {
                    result.entity.render.material = red;

                    // Render the normal on the surface from the hit point
                    // @ts-ignore engine-tsd
                    temp.copy(result.normal).scale(0.3).add(result.point);
                    app.renderLine(result.point, temp, blue);
                }

                y = -2 + 1.2 * Math.sin(time);
                start.set(0, y, 0);
                end.set(10, y, 0);

                // Render the ray used in the raycast
                app.renderLine(start, end, white);

                // @ts-ignore engine-tsd
                const results = app.systems.rigidbody.raycastAll(start, end);
                results.forEach(function (result: { entity: pc.Entity, point: pc.Vec3 }) {
                    result.entity.render.material = red;

                    // Render the normal on the surface from the hit point
                    // @ts-ignore engine-tsd
                    temp.copy(result.normal).scale(0.3).add(result.point);
                    app.renderLine(result.point, temp, blue);
                }, this);
            });

            const createText = function (fontAsset: pc.Asset, message: string, x: number, y: number, z: number, rot: number) {
                // Create a text element-based entity
                const text = new pc.Entity();
                text.addComponent("element", {
                    anchor: [0.5, 0.5, 0.5, 0.5],
                    fontAsset: fontAsset,
                    fontSize: 0.5,
                    pivot: [0, 0.5],
                    text: message,
                    type: pc.ELEMENTTYPE_TEXT
                });
                text.setLocalPosition(x, y, z);
                text.setLocalEulerAngles(0, 0, rot);
                app.root.addChild(text);
            };

            createText(assets.font, 'raycastFirst', 0.5, 3.75, 0, 0);
            createText(assets.font, 'raycastAll', 0.5, -0.25, 0, 0);
        }
    }
}

export default RaycastExample;
