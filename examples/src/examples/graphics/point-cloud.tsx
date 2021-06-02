import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

const vshader = `
// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;
uniform mat4   matrix_view;

// time
uniform float uTime;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry
    mat4 modelView = matrix_view * matrix_model;
    mat4 modelViewProj = matrix_viewProjection * matrix_model;
    gl_Position = modelViewProj * aPosition;

    // vertex in world space
    vec4 vertexWorld = matrix_model * aPosition;

    // use sine way to generate intensity value based on time and also y-coordinate of model
    float intensity = abs(sin(0.6 * vertexWorld.y + uTime * 1.0));

    // intensity smoothly drops to zero for smaller values than 0.9
    intensity = smoothstep(0.9, 1.0, intensity);

    // point size depends on intensity
    gl_PointSize = clamp(12.0 * intensity, 1.0, 64.0);

    // color mixes red and yellow based on intensity
    outColor = mix(vec4(1.0, 1.0, 0.0, 1.0), vec4(0.9, 0.0, 0.0, 1.0), intensity);
}
`;

const fshader = `
precision lowp float;
varying vec4 outColor;

void main(void)
{
    // just output color supplied by vertex shader
    gl_FragColor = outColor;
}
`;

class PointCloudExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Point Cloud';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='shader.vert' type='shader' data={vshader} />
            <AssetLoader name='shader.frag' type='shader' data={fshader} />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        camera.translate(0, 7, 24);

        // Add entity into scene hierarchy
        app.root.addChild(camera);
        app.start();

        // Create a new Entity
        const entity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        // Create the shader definition and shader from the vertex and fragment shaders
        const shaderDefinition = {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION
            },
            vshader: assets['shader.vert'].data,
            fshader: assets['shader.frag'].data
        };
        const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

        // Create a new material with the new shader
        const material = new pc.Material();
        material.shader = shader;

        // find all render components
        const renderComponents = entity.findComponents('render');

        // for all render components
        renderComponents.forEach(function (render: any) {

            // For all meshes in the render component, assign new material
            render.meshInstances.forEach(function (meshInstance: pc.MeshInstance) {
                meshInstance.material = material;
            });

            // set it to render as points
            render.renderStyle = pc.RENDERSTYLE_POINTS;
        });

        let currentTime = 0;
        app.on("update", function (dt) {

            // Update the time and pass it to shader
            currentTime += dt;
            material.setParameter('uTime', currentTime);

            // Rotate the model
            entity.rotate(0, 15 * dt, 0);
        });
    }
}

export default PointCloudExample;
