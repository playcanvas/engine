import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class LinesExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Lines';

    load() {
        return <>
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: {'helipad.dds': pc.Asset}): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // setup skydome
        app.scene.skyboxMip = 2;
        app.scene.exposure = 0.7;
        app.scene.setSkybox(assets['helipad.dds'].resources);

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        camera.setLocalPosition(80, 40, 80);
        camera.lookAt(new pc.Vec3(0, -35, 0));
        app.root.addChild(camera);

        // Create a directional light
        const directionallight = new pc.Entity();
        directionallight.addComponent("light", {
            type: "directional",
            color: pc.Color.WHITE,
            castShadows: false,
            intensity: 1
        });
        app.root.addChild(directionallight);

        // create a circle of sphere meshes
        const spheres: Array<pc.Entity> = [];
        const numInstances = 10;
        for (let i = 0; i < numInstances; i++) {
            const entity = new pc.Entity();
            entity.setLocalScale(4, 4, 4);

            // use material with random color
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
            material.update();

            // create render component
            entity.addComponent("render", {
                type: (i % 2 ? "sphere" : "cylinder"),
                material: material
            });

            if (!(i % 2)) {
                entity.setLocalScale(3, 5, 3);
            }

            // add entity for rendering
            app.root.addChild(entity);
            spheres.push(entity);
        }

        // helper function to generate elevation of a point with [x, y] coordinates
        function groundElevation(time: number, x: number, z: number) {
            return Math.sin(time + 0.2 * x) * 2 + Math.cos(time * 0.2 + 0.5 * z + 0.2 * x);
        }

        // helper function to generate a color for 3d point by lerping between green and red color
        // based on its y coordinate
        function groundColor(point: pc.Vec3) {
            return new pc.Color().lerp(pc.Color.GREEN, pc.Color.RED, pc.math.clamp((point.y + 3) * 0.25, 0, 1));
        }

        // access two layers, used to render lines to them
        const worldLayer = app.scene.layers.getLayerByName("World");
        const immediateLayer = app.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE);

        // bounding box of the meshes
        const bounds = new pc.BoundingBox();

        // Set an update function on the app's update event
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // generate grid of lines
            const positions = [];
            const colors = [];
            for (let x = 1; x < 60; x++) {
                for (let z = 1; z < 60; z++) {

                    // generate 3 points: one start point, one along x and one along z axis
                    const pt1 = new pc.Vec3(x, groundElevation(time, x, z), z);
                    const pt2 = new pc.Vec3(x - 1, groundElevation(time, x - 1, z), z);
                    const pt3 = new pc.Vec3(x, groundElevation(time, x, z - 1), z - 1);

                    // add line connecting points along z axis
                    if (x > 1) {
                        positions.push(pt1, pt2);
                        colors.push(groundColor(pt1), groundColor(pt2));
                    }

                    // add line connecting points along x axis
                    if (z > 1) {
                        positions.push(pt1, pt3);
                        colors.push(groundColor(pt1), groundColor(pt3));
                    }
                }
            }

            // submit the generated array of lines for rendering
            app.renderLines(positions, colors);

            // handle the array of sphere meshes
            for (let i = 0; i < numInstances; i++) {

                // move them equally spaced out around in the circle
                const offset = i * Math.PI * 2 / numInstances;
                const entity = spheres[i];
                entity.setLocalPosition(
                    30 + 20 * Math.sin(time * 0.2 + offset),
                    5 + 2 * Math.sin(time + 3 * i / numInstances),
                    30 + 20 * Math.cos(time * 0.2 + offset)
                );

                // update bounding box for all meshes
                const thisBounds = entity.render.meshInstances[0].aabb;
                if (i === 0) {
                    bounds.copy(thisBounds);
                } else {
                    bounds.add(thisBounds);
                }

                const options = {

                    // half of them are rendered in immediate layer, the other half in world layer
                    layer: i < 0.5 * numInstances ? immediateLayer : worldLayer,

                    // half of them uses depth testing, the other does not, and so lines show through the sphere
                    depthTest: i < 0.5 * numInstances
                };

                // render either wiframe sphere or cube around the sphere objects
                if (i % 2) {
                    // @ts-ignore
                    app.renderWireSphere(entity.getLocalPosition(), 2.2, pc.Color.YELLOW, 30, options);
                } else {

                    // rotate the cylinders
                    entity.rotate((i + 1) * dt, 4 * (i + 1) * dt, 6 * (i + 1) * dt);
                    // @ts-ignore
                    app.renderWireCube(entity.getWorldTransform(), pc.Color.CYAN, options);
                }
            }

            // wireframe box for the bounds around all meshes
            // @ts-ignore
            app.renderWireAlignedBox(bounds.getMin(), bounds.getMax(), pc.Color.WHITE);

        });
    }
}

export default LinesExample;
