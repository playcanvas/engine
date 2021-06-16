import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class HardwareInstancingExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Hardware Instancing';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {


        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

        // Create an Entity with a omni light component, which is casting shadows (using rendering to cubemap)
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(2, 3, 1),
            radius: 10,
            castShadows: true
        });

        // add sphere at the position of light
        light.addComponent("model", {
            type: "sphere"
        });

        // Scale the sphere down to 0.1m
        light.setLocalScale(0.1, 0.1, 0.1);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });

        // Add the new Entities to the hierarchy
        app.root.addChild(light);
        app.root.addChild(camera);

        // Move the camera back to see the cubes
        camera.translate(0, 0, 10);

        // create standard material and enable instancing on it
        const material = new pc.StandardMaterial();
        material.onUpdateShader = function (options) {
            options.useInstancing = true;
            return options;
        };
        material.update();

        // Create a Entity with a Box model component and the instancing material
        const box = new pc.Entity();
        box.addComponent("model", {
            material: material,
            type: "box"
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
            const boxMeshInst = box.model.meshInstances[0];
            boxMeshInst.setInstancing(vertexBuffer);
        }

        // Set an update function on the app's update event
        let angle = 0;
        app.on("update", function (dt) {
            angle += dt * 0.2;

            // Move the light in a circle
            light.setLocalPosition(7 * Math.sin(angle), 7 * Math.cos(angle), 0);

            // orbit camera around
            camera.setLocalPosition(10 * Math.sin(angle), 0, 10 * Math.cos(angle));
            camera.lookAt(pc.Vec3.ZERO);
        });
    }
}

export default HardwareInstancingExample;
