import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

const vshader = `
// Attributes per vertex: position, normal and texture coordinates
attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;
uniform mat4   matrix_view;
uniform mat3   matrix_normal;
uniform vec3   uLightPos;

// Color to fragment program
varying float vertOutTexCoord;
varying vec2 texCoord;

void main(void)
{
    mat4 modelView = matrix_view * matrix_model;
    mat4 modelViewProj = matrix_viewProjection * matrix_model;

    // Get surface normal in eye coordinates
    vec3 eyeNormal = normalize(matrix_normal * aNormal);

    // Get vertex position in eye coordinates
    vec4 vertexPos = modelView * aPosition;
    vec3 vertexEyePos = vertexPos.xyz / vertexPos.w;

    // Get vector to light source
    vec3 lightDir = normalize(uLightPos - vertexEyePos);

    // Dot product gives us diffuse intensity. The diffuse intensity will be
    // used as the 1D color texture coordinate to look for the color of the
    // resulting fragment (see fragment shader).
    vertOutTexCoord = max(0.0, dot(eyeNormal, lightDir));
    texCoord = aUv;

    // Transform the geometry
    gl_Position = modelViewProj * aPosition;
}`;

const fshader = `
precision mediump float;
uniform sampler2D uTexture;
varying float vertOutTexCoord;
varying vec2 texCoord;
void main(void)
{
    float v = vertOutTexCoord;
    v = float(int(v * 6.0)) / 6.0;
    // vec4 color = texture2D (uTexture, texCoord); // try this to use the diffuse color.
    vec4 color = vec4(0.5, 0.47, 0.43, 1.0);
    gl_FragColor = color * vec4(v, v, v, 1.0);
}
`;

class ShaderToonExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Shader Toon';

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
                aNormal: pc.SEMANTIC_NORMAL,
                aUv: pc.SEMANTIC_TEXCOORD0
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

        // material parameters
        const lightPosArray = [light.getPosition().x, light.getPosition().y, light.getPosition().z];
        material.setParameter('uLightPos', lightPosArray);
        material.setParameter('uTexture', originalTexture);
        material.update();

        // rotate the statue
        app.on("update", function (dt) {
            entity.rotate(0, 60 * dt, 0);
        });
    }
}

export default ShaderToonExample;
