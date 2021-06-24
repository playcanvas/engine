import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class MeshMorphManyExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Mesh Morph Many';

    load() {
        return <>
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { 'helipad.dds': pc.Asset}): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // setup skydome
        app.scene.skyboxMip = 2;
        app.scene.setSkybox(assets['helipad.dds'].resources);

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // Create an entity with a directional light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            castShadows: true,
            shadowBias: 0.5,
            shadowDistance: 25,
            color: new pc.Color(0.5, 0.5, 0.5)
        });
        app.root.addChild(light);
        light.setLocalEulerAngles(45, 45, 0);

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        app.root.addChild(camera);

        // position the camera
        camera.setLocalPosition(0, 4, 14);
        camera.lookAt(pc.Vec3.ZERO);

        // helper function to return the shortest distance from point [x, y, z] to a plane defined by [a, b, c] normal and constant d
        const shortestDistance = function (x: number, y: number, z: number, a: number, b: number, c: number, d: number) {
            d = Math.abs((a * x + b * y + c * z + d));
            const e = Math.sqrt(a * a + b * b + c * c);
            return d / e;
        };

        // helper function that creates a morph target from original positions, normals and indices, and a plane normal [nx, ny, nz]
        const createMorphTarget = function (positions: string | any[], normals: any[], indices: any[], offset: number, nx: number, ny: number, nz: number) {

            // modify vertices to separate array
            const modifiedPositions = new Float32Array(positions.length);
            let dist: number;
            let i: number;
            let displacement: number;
            const limit = 0.2 + Math.random() * 0.5;
            const range = 1 + 2 * Math.random();
            for (i = 0; i < positions.length; i += 3) {
                // distance of the point to the specified plane
                dist = shortestDistance(positions[i], positions[i + 1], positions[i + 2], nx, ny, nz, offset);

                // modify distance to displacement amoint - displace nearby points more than distant points
                displacement = pc.math.clamp(dist, 0, limit);
                displacement = pc.math.smoothstep(0, limit, dist);
                displacement = 1 - displacement;
                displacement *= range;

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

        // create the base mesh - a sphere, with higher amount of vertices / triangles
        const mesh = pc.createCylinder(app.graphicsDevice, { height: 10, heightSegments: 200, capSegments: 100 });

        // obtain base mesh vertex / index data
        const srcPositions: Float32Array | number[] | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array = [], srcNormals: Float32Array | number[] | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array = [], indices: number[] | Uint8Array | Uint16Array | Uint32Array = [];
        mesh.getPositions(srcPositions);
        mesh.getNormals(srcNormals);
        mesh.getIndices(indices);

        // build morph targets by expanding a part of cylinder by the normal
        const targets = [];
        let startOffset = -4.5;
        const endOffset = 4.5;
        const count = 12;
        const deltaOffset = (endOffset - startOffset) / (count - 1);
        for (let o = 0; o < count; o++) {
            targets.push(createMorphTarget(srcPositions, srcNormals, indices, startOffset, 0, 1, 0));
            startOffset += deltaOffset;
        }

        // create a morph using these targets
        mesh.morph = new pc.Morph(targets, app.graphicsDevice);

        // material
        const material = new pc.StandardMaterial();
        material.shininess = 50;
        material.metalness = 0.3;
        material.useMetalness = true;
        material.update();

        // Create the mesh instance
        const meshInstance = new pc.MeshInstance(mesh, material);

        // add morph instance - this is where currently set weights are stored
        const morphInstance = new pc.MorphInstance(mesh.morph);
        // @ts-ignore engine-tsd
        meshInstance.morphInstance = morphInstance;

        // Create Entity and add it to the scene
        const entity = new pc.Entity();
        entity.addComponent("render", {
            material: material,
            meshInstances: [meshInstance]
        });
        entity.setLocalPosition(0, 0, 0);
        app.root.addChild(entity);

        // update function called once per frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // modify weights of all morph targets along sin curve with different frequency
            for (let i = 0; i < targets.length; i++) {
                morphInstance.setWeight(i, Math.abs(Math.sin(time * 2 * (i + 5) / targets.length)));
            }
        });
    }
}

export default MeshMorphManyExample;
