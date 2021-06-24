import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

const vshaderFeedback = `
// vertex shader used to move particles during transform-feedback simulation step

// input and output is vec4, containing position in .xyz and lifetime in .w
attribute vec4 vertex_position;
varying vec4 out_vertex_position;

// parameters controlling simulation
uniform float deltaTime;
uniform float areaSize;

// texture storing random direction vectors
uniform sampler2D directionSampler;

// function returning random number based on vec2 seed parameter
float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main(void) {

    // texture contains direction of particle movement - read it based on particle's position
    vec2 texCoord = vertex_position.xz / areaSize + 0.5;
    vec3 dir = texture2D(directionSampler, texCoord).xyz;
    dir = dir * 2.0 - 1.0;

    // move particle along direction with some speed
    float speed = 20.0 * deltaTime;
    vec3 pos = vertex_position.xyz + dir * speed;

    // age the particle
    float liveTime = vertex_position.w;
    liveTime -= deltaTime;

    // if particle is too old, regenerate it
    if (liveTime <= 0.0) {

        // random life time
        liveTime = rand(pos.xy) * 2.0;

        // random position
        pos.x = rand(pos.xz) * areaSize - 0.5 * areaSize;
        pos.y = rand(pos.xy) * 4.0;
        pos.z = rand(pos.yz) * areaSize - 0.5 * areaSize;
    }

    // write out updated particle
    out_vertex_position = vec4(pos, liveTime);
}
`;

const vshaderCloud = `
// vertex shader used to render point sprite particles

// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry (ignore life time which is stored in .w of position)
    vec4 worldPosition = vec4(aPosition.xyz, 1);
    gl_Position = matrix_viewProjection * worldPosition;

    // point sprite size
    gl_PointSize = 2.0;

    // color depends on position of particle
    outColor = vec4(worldPosition.y * 0.25, 0.1, worldPosition.z * 0.2, 1);
}
`;

const fshaderCloud = `
// fragment shader used to render point sprite particles
precision mediump float;
varying vec4 outColor;

void main(void)
{
    // color supplied by vertex shader
    gl_FragColor = outColor;
}
`;

class TransformFeedbackExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Transform Feedback';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='vshaderFeedback' type='shader' data={vshaderFeedback} />
            <AssetLoader name='vshaderCloud' type='shader' data={vshaderCloud} />
            <AssetLoader name='fshaderCloud' type='shader' data={fshaderCloud} />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // create small 2D texture representing movement direcion (wind)
        const textureResolution = 10;
        const textureData = new Uint8ClampedArray(textureResolution * textureResolution * 4);

        for (let i = 0; i < textureResolution * textureResolution; i++) {

            // rgb store biased movement direction
            textureData[i * 4] = 127 + Math.random() * 50 - 25;
            textureData[i * 4 + 1] = 127 + Math.random() * 50 - 25;
            textureData[i * 4 + 2] = 127 + Math.random() * 50 - 25;

            // set alpha to 255 for debugging purposes
            textureData[i * 4 + 3] = 255;
        }

        // create texture
        const texture = new pc.Texture(app.graphicsDevice, {
            width: textureResolution,
            height: textureResolution,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            cubemap: false,
            mipmaps: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });

        // initialize it with data
        const pixels = texture.lock();
        pixels.set(textureData);
        texture.unlock();

        // Create main camera, which renders the world
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        app.root.addChild(camera);

        // set up texture transform part, on webgl2 devices only
        let tf: any;
        let shader: any;
        const areaSize = 30;

        // resolve parameters to simulation shader parameters
        const areaSizeUniform = app.graphicsDevice.scope.resolve("areaSize");
        const deltaTimeUniform = app.graphicsDevice.scope.resolve("deltaTime");
        const directionSampler = app.graphicsDevice.scope.resolve("directionSampler");

        // @ts-ignore engine-tsd
        if (app.graphicsDevice.webgl2) {

            // simulated particles
            const maxNumPoints = 200000;
            const positions = new Float32Array(4 * maxNumPoints);

            // generate random data, these are used as seeds to generate particles in vertex shader
            for (let i = 0; i < maxNumPoints; i++) {
                positions[i * 4] = Math.random();
                positions[i * 4 + 1] = Math.random();
                positions[i * 4 + 2] = Math.random();

                // set life time to 0 which triggers particle restart in shader
                positions[i * 4 + 3] = 0;
            }

            // store these in a vertex buffer of a mesh
            const mesh = new pc.Mesh(app.graphicsDevice);
            mesh.setPositions(positions, 4);
            mesh.update(pc.PRIMITIVE_POINTS, false);

            // set large bounding box so we don't need to update it each frame
            mesh.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(100, 100, 100));

            // Create the shader from the vertex and fragment shaders which is used to render point sprites
            shader = new pc.Shader(app.graphicsDevice, {
                attributes: { aPosition: pc.SEMANTIC_POSITION },
                vshader: assets.vshaderCloud.data,
                fshader: assets.fshaderCloud.data
            });

            // Create a new material with the new shader and additive alpha blending
            const material = new pc.Material();
            material.shader = shader;
            material.blendType = pc.BLEND_ADDITIVEALPHA;
            material.depthWrite = false;

            // Create the mesh instance
            const node = new pc.GraphNode();
            const meshInstance = new pc.MeshInstance(mesh, material, node);

            // create an entity used to render the mesh instance using a render component
            const entity = new pc.Entity();
            entity.addComponent("render", {
                type: 'asset',
                meshInstances: [meshInstance]
            });
            app.root.addChild(entity);

            // set up transform feedback. This creates a clone of the vertex buffer, and sets up rendering to ping pong between them
            tf = new pc.TransformFeedback(mesh.vertexBuffer);
            shader = pc.TransformFeedback.createShader(app.graphicsDevice, assets.vshaderFeedback.data, "transformShaderExample");
        }

        // update things each frame
        let time = 0;
        app.on("update", function (dt) {

            // rotate camera around
            time += dt;
            camera.setLocalPosition(9 * Math.sin(time * 0.2), 6, 25 * Math.cos(time * 0.2));
            camera.lookAt(new pc.Vec3(0, 3, 0));

            // if transform feedback was initialized
            if (tf) {

                // set up simulation parameters
                areaSizeUniform.setValue(areaSize);
                deltaTimeUniform.setValue(dt);
                directionSampler.setValue(texture);

                // execute simulation
                tf.process(shader);
            }
        });
    }
}

export default TransformFeedbackExample;
