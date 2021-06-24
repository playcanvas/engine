import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class HardwareInstancingExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Hardware Instancing';

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

        app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
        });
        app.root.addChild(camera);

        // Move the camera back to see the cubes
        camera.translate(0, 0, 10);

        // create standard material and enable instancing on it
        const material = new pc.StandardMaterial();
        material.onUpdateShader = function (options) {
            options.useInstancing = true;
            return options;
        };
        material.shininess = 60;
        material.metalness = 0.7;
        material.useMetalness = true;
        material.update();

        // Create a Entity with a cylinder render component and the instancing material
        const box = new pc.Entity();
        box.addComponent("render", {
            material: material,
            type: "cylinder"
        });

        // add the box entity to the hierarchy
        app.root.addChild(box);

        if (app.graphicsDevice.supportsInstancing) {
            // number of instances to render
            const instanceCount = 1000;

            // store matrices for individual instances into array
            const matrices = new Float32Array(instanceCount * 16);
            let matrixIndex = 0;

            const radius = 5;
            const pos = new pc.Vec3();
            const rot = new pc.Quat();
            const scl = new pc.Vec3();
            const matrix = new pc.Mat4();

            for (let i = 0; i < instanceCount; i++) {
                // generate random positions / scales and rotations
                pos.set(Math.random() * radius - radius * 0.5, Math.random() * radius - radius * 0.5, Math.random() * radius - radius * 0.5);
                scl.set(0.1 + Math.random() * 0.1, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.1);
                rot.setFromEulerAngles(i * 30, i * 50, i * 70);
                matrix.setTRS(pos, rot, scl);

                // copy matrix elements into array of floats
                for (let m = 0; m < 16; m++)
                    matrices[matrixIndex++] = matrix.data[m];
            }

            // create static vertex buffer containing the matrices
            const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, pc.VertexFormat.defaultInstancingFormat, instanceCount, pc.BUFFER_STATIC, matrices);

            // initialise instancing using the vertex buffer on meshInstance of the created box
            const boxMeshInst = box.render.meshInstances[0];
            boxMeshInst.setInstancing(vertexBuffer);
        }

        // Set an update function on the app's update event
        let angle = 0;
        app.on("update", function (dt) {
            // orbit camera around
            angle += dt * 0.2;
            camera.setLocalPosition(8 * Math.sin(angle), 0, 8 * Math.cos(angle));
            camera.lookAt(pc.Vec3.ZERO);
        });
    }
}

export default HardwareInstancingExample;
