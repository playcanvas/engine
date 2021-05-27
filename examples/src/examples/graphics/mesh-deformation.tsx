import React from 'react';
import * as pc from 'playcanvas';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class MeshDeformationExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Mesh Deformation';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { statue: pc.Asset }): void {

        // Create the app
        const app = new pc.Application(canvas, {});

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 7, 24);
        app.root.addChild(camera);

        // Create an Entity with a omni light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 100,
            castShadows: true
        });
        light.translate(5, 0, 15);
        app.root.addChild(light);

        // collected info about meshes to modify
        const allMeshes: any = [];

        const entity = new pc.Entity();
        entity.addComponent("model", {
            type: "asset",
            asset: assets.statue.resource.model,
            castShadows: true
        });
        app.root.addChild(entity);

        // collect positions from all mesh instances to work on
        let i;
        const meshInstances = entity.model.model.meshInstances;
        for (i = 0; i < meshInstances.length; i++) {

            const meshInstance = meshInstances[i];

            // get positions from the mesh
            const mesh = meshInstance.mesh;
            const srcPositions: any = [];
            mesh.getPositions(srcPositions);

            // store it
            allMeshes.push({
                mesh: mesh,
                srcPositions: srcPositions
            });
        }

        // start the application when all is set up
        app.start();

        // temporary work array of positions to avoid per frame allocations
        const tempPositions: any = [];

        let k, time = 0;
        app.on("update", function (dt) {
            time += dt;

            if (entity) {
                // rotate the model around
                entity.rotate(0, 5 * dt, 0);

                const strength = 50;

                // modify mesh positions on each frame
                for (i = 0; i < allMeshes.length; i++) {
                    tempPositions.length = 0;
                    const srcPositions = allMeshes[i].srcPositions;

                    // loop over all positions, and fill up tempPositions array with waved version of positions from srcPositions array
                    // modify .x and .z components based on sin function, which uses .y component
                    for (k = 0; k < srcPositions.length; k += 3) {
                        tempPositions[k] = srcPositions[k] + strength * Math.sin(time + srcPositions[k + 1] * 0.01);
                        tempPositions[k + 1] = srcPositions[k + 1];
                        tempPositions[k + 2] = srcPositions[k + 2] + strength * Math.sin(time + srcPositions[k + 1] * 0.01);
                    }

                    // set new positions on the mesh
                    const mesh = allMeshes[i].mesh;
                    mesh.setPositions(tempPositions);
                    mesh.update();
                }
            }
        });
    }
}

export default MeshDeformationExample;
