import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader, ScriptLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

// custom point cloud rendering vertex shader
const vshader = `
    // Attributes per vertex: position
    attribute vec4 aPosition;
    attribute vec4 aColor;

    uniform mat4   matrix_viewProjection;
    uniform mat4   matrix_model;

    // Color to fragment program
    varying vec4 outColor;

    void main(void)
    {
        mat4 modelViewProj = matrix_viewProjection * matrix_model;
        gl_Position = modelViewProj * aPosition;

        gl_PointSize = 1.5;
        outColor = aColor;
    }
`;

// custom point cloud rendering fragment shader
const fshader = `
    precision lowp float;
    varying vec4 outColor;

    void main(void)
    {
        // just output color supplied by vertex shader
        gl_FragColor = outColor;
    }
`;

class LoadersGlExample extends Example {
    static CATEGORY = 'Loaders';
    static NAME = 'Loaders.gl';

    load() {
        return <>
            <AssetLoader name='shader.vert' type='shader' data={vshader} />
            <AssetLoader name='shader.frag' type='shader' data={fshader} />
            <ScriptLoader name='CORE' url='https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js' />
            <ScriptLoader name='DRACO' url='https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {
        // This example uses draco point cloud loader library from https://loaders.gl/
        // Note that many additional formats are supported by the library and can be used.

        // Create the app
        const app = new pc.Application(canvas, {});

        async function loadModel(url:string) {

            // load the url using the draco format loader
            // @ts-ignore: cannot find CORE and DRACO
            const modelData = await CORE.load(url, DRACO.DracoLoader);

            // based on the loaded data, create the mesh with position and color vertex data
            const mesh = new pc.Mesh(app.graphicsDevice);
            mesh.clear(true, false);
            mesh.setPositions(modelData.attributes.POSITION.value, modelData.attributes.POSITION.size);
            mesh.setColors32(modelData.attributes.COLOR_0.value, modelData.attributes.COLOR_0.size);
            mesh.update(pc.PRIMITIVE_POINTS);

            // Create shader to render mesh as circular points with color
            const shaderDefinition = {
                attributes: {
                    aPosition: pc.SEMANTIC_POSITION,
                    aColor: pc.SEMANTIC_COLOR
                },
                vshader: assets['shader.vert'].data,
                fshader: assets['shader.frag'].data
            };
            const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

            // create material using the shader
            const material = new pc.Material();
            material.shader = shader;
            material.blendType = pc.BLENDMODE_ONE_MINUS_DST_ALPHA;
            material.cull = pc.CULLFACE_NONE;

            // Add an entity with a render compoonent to render the mesh
            const entity = new pc.Entity();
            entity.addComponent('render', {
                material: material,
                meshInstances: [new pc.MeshInstance(mesh, material)]
            });

            app.root.addChild(entity);
        }

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1),
            farClip: 100
        });
        camera.translate(-20, 15, 20);
        camera.lookAt(0, 7, 0);
        app.root.addChild(camera);

        // load the draco model, and then start the application
        loadModel("static/assets/models/park_points.drc").then(() => {
            app.start();
        });

        // update things each frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // orbit the camera
            if (camera) {
                camera.setLocalPosition(40 * Math.sin(time * 0.5), 10, 20 * Math.cos(time * 0.5));
                camera.lookAt(pc.Vec3.ZERO);
            }
        });
    }
}

export default LoadersGlExample;
