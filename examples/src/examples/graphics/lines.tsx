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

    example(canvas: HTMLCanvasElement, assets: {'helipad.dds': pc.Asset}): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // setup skydome
        app.scene.skyboxMip = 2;
        app.scene.exposure = 1.0;
        app.scene.setSkybox(assets['helipad.dds'].resources);
        app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 30, 0);

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
            castShadows: false
        });
        app.root.addChild(directionallight);

        // create a circle of meshes
        const meshes: Array<pc.Entity> = [];
        const numMeshes = 10;
        for (let i = 0; i < numMeshes; i++) {
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
            meshes.push(entity);
        }

        // helper function to generate elevation of a point with [x, y] coordinates
        function groundElevation(time: number, x: number, z: number) {
            return Math.sin(time + 0.2 * x) * 2 + Math.cos(time * 0.2 + 0.5 * z + 0.2 * x);
        }

        // helper function to generate a color for 3d point by lerping between green and red color
        // based on its y coordinate
        function groundColor(color: pc.Color, point: pc.Vec3) {
            color.lerp(pc.Color.GREEN, pc.Color.RED, pc.math.clamp((point.y + 3) * 0.25, 0, 1));
        }

        // access to two layers used to render lines
        const worldLayer = app.scene.layers.getLayerByName("World");
        const immediateLayer = app.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE);

        // Set an update function on the app's update event
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // generate grid of lines - store positions and colors as an arrays of numbers instead of
            // Vec3s and Colors to improve performance
            const positions = [];
            const colors = [];

            // temporary instances for calculations
            const pt1 = new pc.Vec3();
            const pt2 = new pc.Vec3();
            const pt3 = new pc.Vec3();
            const c1 = new pc.Color();
            const c2 = new pc.Color();
            const c3 = new pc.Color();

            for (let x = 1; x < 60; x++) {
                for (let z = 1; z < 60; z++) {

                    // generate 3 points: one start point, one along x and one along z axis
                    pt1.set(x, groundElevation(time, x, z), z);
                    pt2.set(x - 1, groundElevation(time, x - 1, z), z);
                    pt3.set(x, groundElevation(time, x, z - 1), z - 1);

                    // generate colors for the 3 points
                    groundColor(c1, pt1);
                    groundColor(c2, pt2);
                    groundColor(c3, pt3);

                    // add line connecting points along z axis
                    if (x > 1) {
                        positions.push(pt1.x, pt1.y, pt1.z, pt2.x, pt2.y, pt2.z);
                        colors.push(c1.r, c1.g, c1.b, c1.a, c2.r, c2.g, c2.b, c2.a);
                    }

                    // add line connecting points along x axis
                    if (z > 1) {
                        positions.push(pt1.x, pt1.y, pt1.z, pt3.x, pt3.y, pt3.z);
                        colors.push(c1.r, c1.g, c1.b, c1.a, c3.r, c3.g, c3.b, c3.a);
                    }
                }
            }

            // submit the generated arrays of lines and colors for rendering
            app.drawLineArrays(positions, colors);

            // array of Vec3 and Color classes for different way to render lines
            const grayLinePositions = [];
            const grayLineColors = [];

            // handle the array of meshes
            for (let i = 0; i < numMeshes; i++) {

                // move them equally spaced out around in the circle
                const offset = i * Math.PI * 2 / numMeshes;
                const entity = meshes[i];
                entity.setLocalPosition(
                    30 + 20 * Math.sin(time * 0.2 + offset),
                    5 + 2 * Math.sin(time + 3 * i / numMeshes),
                    30 + 20 * Math.cos(time * 0.2 + offset)
                );

                // half of them uses depth testing, the others do not, and so lines show through the mesh
                const depthTest = i < 0.5 * numMeshes;

                // half of them are rendered in immediate layer, the other half in world layer
                const layer = i < 0.5 * numMeshes ? immediateLayer : worldLayer;

                // rotate the meshes
                entity.rotate((i + 1) * dt, 4 * (i + 1) * dt, 6 * (i + 1) * dt);

                // draw a single magenta line from this mesh to the next mesh
                const nextEntity = meshes[(i + 1) % meshes.length];
                app.drawLine(entity.getPosition(), nextEntity.getPosition(), pc.Color.MAGENTA);

                // store positions and colors of lines connecting objects to a center point
                grayLinePositions.push(entity.getPosition(), new pc.Vec3(0, 10, 0));
                grayLineColors.push(pc.Color.GRAY, pc.Color.GRAY);
            }

            // render all gray lines
            app.drawLines(grayLinePositions, grayLineColors);
        });
    }
}

export default LinesExample;
