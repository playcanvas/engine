import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class MeshDeformationExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Mesh Deformation';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { statue: pc.Asset, 'helipad.dds': pc.Asset }): void {

        // Create the app
        const app = new pc.Application(canvas, {});

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // setup skydome
        app.scene.skyboxMip = 2;
        app.scene.exposure = 2;
        app.scene.setSkybox(assets['helipad.dds'].resources);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 7, 24);
        app.root.addChild(camera);

        // create a hierarchy of entities with render components, representing the statue model
        const entity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        // collect positions from all mesh instances to work on
        const allMeshes: any = [];
        const renders: Array<pc.RenderComponent> = entity.findComponents("render");
        renders.forEach((render) => {

            // collect positions from all mesh instances on this render component
            const meshInstances = render.meshInstances;
            for (let i = 0; i < meshInstances.length; i++) {
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
        });

        // start the application when all is set up
        app.start();

        // temporary work array of positions to avoid per frame allocations
        const tempPositions: any = [];

        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            if (entity) {

                // orbit the camera
                camera.setLocalPosition(25 * Math.sin(time * 0.2), 15, 25 * Math.cos(time * 0.2));
                camera.lookAt(new pc.Vec3(0, 7, 0));

                const strength = 50;

                // modify mesh positions on each frame
                for (let i = 0; i < allMeshes.length; i++) {
                    tempPositions.length = 0;
                    const srcPositions = allMeshes[i].srcPositions;

                    // loop over all positions, and fill up tempPositions array with waved version of positions from srcPositions array
                    // modify .x and .z components based on sin function, which uses .y component
                    for (let k = 0; k < srcPositions.length; k += 3) {
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
