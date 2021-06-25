import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

const vshader = `
attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec2 vUv0;

void main(void)
{
    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
}
`;

const fshader = `
precision mediump float;

varying vec2 vUv0;

uniform sampler2D uDiffuseMap;
uniform sampler2D uHeightMap;
uniform float uTime;

void main(void)
{
    float height = texture2D(uHeightMap, vUv0).r;
    vec4 color = texture2D(uDiffuseMap, vUv0);
    if (height < uTime) {
      discard;
    }
    if (height < (uTime + uTime * 0.1)) {
      color = vec4(1.0, 0.2, 0.0, 1.0);
    }
    gl_FragColor = color;
}
`;

class ShaderBurnExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Shader Burn';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='clouds' type='texture' url='static/assets/textures/clouds.jpg' />
            <AssetLoader name='shader.vert' type='shader' data={vshader} />
            <AssetLoader name='shader.frag' type='shader' data={fshader} />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 7, 24);

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

        app.start();

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
        material.setParameter('uHeightMap', assets.clouds.resource);

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

        let time = 0;
        app.on("update", function (dt) {
            time += 0.2 * dt;

            // reverse time
            let t = time % 2;
            if (t > 1) {
                t = 1 - (t - 1);
            }

            // set time parameter for the shader
            material.setParameter('uTime', t);
            material.update();
        });
    }
}

export default ShaderBurnExample;
