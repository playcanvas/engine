import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

const vshader = `
attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;

varying vec2 vUv0;

void main(void)
{
    vec4 pos = matrix_model * vec4(aPosition, 1.0);
    pos.x += sin(uTime + pos.y * 4.0) * 0.1;
    pos.y += cos(uTime + pos.x * 4.0) * 0.1;
    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * pos;
}
`;

const fshader = `
precision mediump float;

uniform sampler2D uDiffuseMap;

varying vec2 vUv0;

void main(void)
{
    gl_FragColor = texture2D(uDiffuseMap, vUv0);
}
`;

class ShaderWobbleExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Shader Wobble';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='shader.vert' type='shader' data={vshader} />
            <AssetLoader name='shader.frag' type='shader' data={fshader} />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {
        let time = 0;

        // Create the application and start the update loop
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
        camera.translate(0, 7, 25);

        // Create an Entity with a omni light component and a sphere model component.
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            radius: 10
        });
        light.translate(0, 1, 0);

        // Add entities into scene hierarchy
        app.root.addChild(camera);
        app.root.addChild(light);

        // Create the shader definition and shader from the vertex and fragment shaders
        const shaderDefinition = {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION,
                aUv0: pc.SEMANTIC_TEXCOORD0
            },
            vshader: assets['shader.vert'].data,
            fshader: assets['shader.frag'].data
        };

        const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

        // Create a new material with the new shader
        const material = new pc.Material();
        material.shader = shader;

        // create a hierarchy of entities with render components, representing the statue model
        const entity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        // Set the new material on all meshes in the model, and use original texture from the model on the new material
        let originalTexture:pc.Texture = null;
        const renders: Array<pc.RenderComponent> = entity.findComponents("render");
        renders.forEach((render) => {
            const meshInstances = render.meshInstances;
            for (let i = 0; i < meshInstances.length; i++) {
                const meshInstance = meshInstances[i];
                // @ts-ignore
                if (!originalTexture) originalTexture = meshInstance.material.diffuseMap;
                meshInstance.material = material;
            }
        });

        // material is set up, update it
        material.setParameter('uDiffuseMap', originalTexture);
        material.update();

        app.on("update", function (dt) {
            time += dt;

            // set time parameter for the shader
            material.setParameter('uTime', time);
            material.update();
        });

        app.start();
    }
}

export default ShaderWobbleExample;
