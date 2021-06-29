import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

const vshader = `
attribute vec3 aPosition;
attribute vec2 aUv;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec2 texCoord;

void main(void)
{
    // project the position
    vec4 pos = matrix_model * vec4(aPosition, 1.0);
    gl_Position = matrix_viewProjection * pos;


    texCoord = aUv;
}
`;

const fshader = `
precision mediump float;

// use the special texture_grabPass texture, which is a built-in texture. Each time this texture is used
// for rendering, the engine will copy color framebuffer to it which represents already rendered the scene
uniform sampler2D texture_grabPass;

// normal map providing offsets
uniform sampler2D uOffsetMap;

// engine built-in costant storing render target size in .xy and inverse size in .zw
uniform vec4 uScreenSize;

varying vec2 texCoord;

void main(void)
{
    // sample offset texture
    vec2 offset = texture2D(uOffsetMap, texCoord).rg;
    offset = 2.0 * offset - 1.0;

    // offset strength
    offset *= 0.03;

    // get normalized uv coordinates for canvas.
    vec2 grab_uv = gl_FragCoord.xy * uScreenSize.zw;

    // get existing pixel color with distorted offset
    vec3 grab_color = texture2D(texture_grabPass, grab_uv + offset).rgb;

    // brighten the refracted texture a little bit
    gl_FragColor = vec4(grab_color * 1.2, 1.0);
}
`;

class GrabPassExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Grab Pass';

    load() {
        return <>
            <AssetLoader name='shader.vert' type='shader' data={vshader} />
            <AssetLoader name='shader.frag' type='shader' data={fshader} />
            <AssetLoader name='normal' type='texture' url='static/assets/textures/normal-map.png' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { 'shader.vert': pc.Asset, 'shader.frag': pc.Asset, normal: pc.Asset }): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // helper function to create a primitive with shape type, position, scale, color
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, color: pc.Color) {
            // create material of specified color
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create ground plane
        createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(20, 20, 20), new pc.Color(0.3, 0.5, 0.3));

        // create 3 primitives, keep their references to rotate them later
        const primitives: any = [];
        primitives.push(createPrimitive("sphere", new pc.Vec3(-4, 2, -6), new pc.Vec3(2, 6, 3), new pc.Color(1, 0, 0)));
        primitives.push(createPrimitive("box", new pc.Vec3(4, 2, -7), new pc.Vec3(6, 3, 3), new pc.Color(1, 1, 0)));
        primitives.push(createPrimitive("cone", new pc.Vec3(0, 2, 7), new pc.Vec3(2, 5, 2), new pc.Color(0, 1, 1)));

        // Create the camera, which renders entities
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });
        app.root.addChild(camera);
        camera.setLocalPosition(0, 10, 20);
        camera.lookAt(pc.Vec3.ZERO);

        // Create an Entity with a omni light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 100,
            castShadows: true
        });
        light.translate(0, 15, 2);
        app.root.addChild(light);

        // create a primitive which uses refraction shader to distort the view behind it
        const glass = createPrimitive("box", new pc.Vec3(1, 3, 0), new pc.Vec3(10, 6, 3), new pc.Color(1, 1, 1));
        glass.render.castShadows = false;
        glass.render.receiveShadows = false;

        // create shader using vertex and fragment shaders
        const shaderDefinition = {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION,
                aUv: pc.SEMANTIC_TEXCOORD0
            },
            vshader: assets['shader.vert'].data,
            fshader: assets['shader.frag'].data
        };

        // reflection material using the shader
        const refractionMaterial = new pc.Material();
        refractionMaterial.shader = new pc.Shader(app.graphicsDevice, shaderDefinition);
        glass.render.material = refractionMaterial;

        // set up front to back sorting on opaque world layer - so when we get to render the glass,
        // object behind it would be rendered already
        const worldLayer = app.scene.layers.getLayerByName("World");
        worldLayer.opaqueSortMode = pc.SORTMODE_BACK2FRONT;

        // set it as offset map on the material
        refractionMaterial.setParameter('uOffsetMap', assets.normal.resource);
        refractionMaterial.update();
        app.start();

        // update things each frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // rotate the primitives
            primitives.forEach(function (prim: pc.Entity) {
                prim.rotate(0.3, 0.2, 0.1);
            });

            // orbit the camera
            camera.setLocalPosition(20 * Math.sin(time * 0.5), 10, 20 * Math.cos(time * 0.5));
            camera.lookAt(pc.Vec3.ZERO);

        });
    }
}

export default GrabPassExample;
