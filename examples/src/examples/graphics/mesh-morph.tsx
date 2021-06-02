import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class MeshMorphExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Mesh Morph';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // Create an entity with a directional light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional"
        });
        app.root.addChild(light);
        light.setLocalEulerAngles(45, 30, 0);

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        app.root.addChild(camera);

        // helper function to return the shortest distance from point [x, y, z] to a plane defined by [a, b, c] normal
        const shortestDistance = function (x: number, y: number, z: number, a: number, b: number, c: number) {
            const d = Math.abs(a * x + b * y + c * z);
            const e = Math.sqrt(a * a + b * b + c * c);
            return d / e;
        };

        // helper function that creates a morph target from original positions, normals and indices, and a plane normal [nx, ny, nz]
        const createMorphTarget = function (positions: string | any[], normals: any[], indices: any[], nx: number, ny: number, nz: number) {

            // modify vertices to separate array
            const modifiedPositions = new Float32Array(positions.length);
            let dist: number, i: number, displacement: number;
            const limit = 0.2;
            for (i = 0; i < positions.length; i += 3) {
                // distance of the point to the specified plane
                dist = shortestDistance(positions[i], positions[i + 1], positions[i + 2], nx, ny, nz);

                // modify distance to displacement amoint - displace nearby points more than distant points
                displacement = pc.math.clamp(dist, 0, limit);
                displacement = pc.math.smoothstep(0, limit, dist);
                displacement = 1 - displacement;

                // generate new position by extruding vertex along normal by displacement
                modifiedPositions[i] = positions[i] + normals[i] * displacement;
                modifiedPositions[i + 1] = positions[i + 1] + normals[i + 1] * displacement;
                modifiedPositions[i + 2] = positions[i + 2] + normals[i + 2] * displacement;
            }

            // generate normals based on modified positions and indices
            // @ts-ignore engine-tsd
            const modifiedNormals = new Float32Array(pc.calculateNormals(modifiedPositions, indices));

            // generate delta positions and normals - as morph targets store delta between base position / normal and modified position / normal
            for (i = 0; i < modifiedNormals.length; i++) {
                modifiedPositions[i] -= positions[i];
                modifiedNormals[i] -= normals[i];
            }

            // create a morph target
            // @ts-ignore engine-tsd
            return new pc.MorphTarget({
                deltaPositions: modifiedPositions,
                deltaNormals: modifiedNormals
            });
        };

        const createMorphInstance = function (x: number | pc.Vec3, y: number, z: number) {
            // create the base mesh - a sphere, with higher amount of vertices / triangles
            // @ts-ignore engine-tsd
            const mesh = pc.createSphere(app.graphicsDevice, { latitudeBands: 200, longitudeBands: 200 });

            // obtain base mesh vertex / index data
            const srcPositions: Float32Array | number[] | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array = [], srcNormals: Float32Array | number[] | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array = [], indices: number[] | Uint8Array | Uint16Array | Uint32Array = [];
            mesh.getPositions(srcPositions);
            mesh.getNormals(srcNormals);
            mesh.getIndices(indices);

            // build 3 targets by expanding a part of sphere along 3 planes, specified by the normal
            const targets = [];
            targets.push(createMorphTarget(srcPositions, srcNormals, indices, 1, 0, 0));
            targets.push(createMorphTarget(srcPositions, srcNormals, indices, 0, 1, 0));
            targets.push(createMorphTarget(srcPositions, srcNormals, indices, 0, 0, 1));

            // create a morph using these 3 targets
            mesh.morph = new pc.Morph(targets, app.graphicsDevice);

            // Create the mesh instance
            const material = new pc.StandardMaterial();
            const meshInstance = new pc.MeshInstance(mesh, material);

            // add morph instance - this is where currently set weights are stored
            const morphInstance = new pc.MorphInstance(mesh.morph);
            // @ts-ignore engine-tsd
            meshInstance.morphInstance = morphInstance;

            // Create Entity and add it to the scene
            const entity = new pc.Entity();
            entity.setLocalPosition(x, y, z);
            app.root.addChild(entity);

            // Add a render compoonent with meshInstance
            entity.addComponent('render', {
                material: material,
                meshInstances: [meshInstance]
            });

            return morphInstance;
        };

        // create 3 morph instances
        const morphInstances: { setWeight: (arg0: number, arg1: number) => void; }[] = [];
        for (let k = 0; k < 3; k++) {
            morphInstances.push(createMorphInstance(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3));
        }

        // update function called once per frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            for (let m = 0; m < morphInstances.length; m++) {
            // modify weights of all 3 morph targets along some sin curve with different frequency
                morphInstances[m].setWeight(0, Math.abs(Math.sin(time + m)));
                morphInstances[m].setWeight(1, Math.abs(Math.sin(time * 0.3 + m)));
                morphInstances[m].setWeight(2, Math.abs(Math.sin(time * 0.7 + m)));
            }

            // orbit camera around
            camera.setLocalPosition(16 * Math.sin(time * 0.2), 4, 16 * Math.cos(time * 0.2));
            camera.lookAt(pc.Vec3.ZERO);
        });
    }
}

export default MeshMorphExample;
