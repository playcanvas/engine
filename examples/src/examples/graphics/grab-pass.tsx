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
// for rendering, the engine will copy color framebuffer to it which represents already rendered scene
uniform sampler2D texture_grabPass;

// normal map providing offsets
uniform sampler2D uOffsetMap;

// roughness map
uniform sampler2D uRoughnessMap;

// engine built-in costant storing render target size in .xy and inverse size in .zw
uniform vec4 uScreenSize;

varying vec2 texCoord;

void main(void)
{
    float roughness = 1.0 - texture2D(uRoughnessMap, texCoord).r;

    // sample offset texture - used to add distortion to the sampled background
    vec2 offset = texture2D(uOffsetMap, texCoord).rg;
    offset = 2.0 * offset - 1.0;

    // offset strength
    offset *= (0.2 + roughness) * 0.015;

    // get normalized uv coordinates for canvas
    vec2 grabUv = gl_FragCoord.xy * uScreenSize.zw;

    // roughness dictates which mipmap level gets used, in 0..4 range
    float mipmap = roughness * 5.0;

    // get background pixel color with distorted offset
    #ifdef GL2
        // only webgl2 (and webgl1 extension - not handled here) supports reading specified mipmap
        vec3 grabColor = texture2D(texture_grabPass, grabUv + offset, mipmap).rgb;
    #else
        vec3 grabColor = texture2D(texture_grabPass, grabUv + offset).rgb;
    #endif

    // brighten the refracted texture a little bit
    // brighten even more the rough parts of the glass
    gl_FragColor = vec4(grabColor * 1.1, 1.0) + roughness * 0.09;
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
            <AssetLoader name="roughness" type="texture" url="static/assets/textures/pc-gray.png" />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: any): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // setup skydome
        app.scene.skyboxMip = 0;
        app.scene.exposure = 2;
        app.scene.setSkybox(assets['helipad.dds'].resources);

        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // Render meshes to immediate layer, which renders after skybox - to include skybox in the refraction.
        // Set up front to back sorting for those meshes - so when we get to render the glass,
        // object behind it would be rendered already
        const immediateLayer = app.scene.layers.getLayerByName("Immediate");
        immediateLayer.opaqueSortMode = pc.SORTMODE_BACK2FRONT;

        // helper function to create a primitive with shape type, position, scale, color
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, color: pc.Color) {
            // create material of specified color
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            material.shininess = 60;
            material.metalness = 0.4;
            material.useMetalness = true;
            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material,
                layers: [immediateLayer.id]
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create few primitives, keep their references to rotate them later
        const primitives: any = [];
        const count = 7;
        const shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
        for (let i = 0; i < count; i++) {
            const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
            const color = new pc.Color(Math.random(), Math.random(), Math.random());
            const angle = 2 * Math.PI * i / count;
            const pos = new pc.Vec3(12 * Math.sin(angle), 0, 12 * Math.cos(angle));
            primitives.push(createPrimitive(shapeName, pos, new pc.Vec3(4, 8, 4), color));
        }

        // Create the camera, which renders entities
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });
        app.root.addChild(camera);
        camera.setLocalPosition(0, 10, 20);
        camera.lookAt(pc.Vec3.ZERO);

        // create a primitive which uses refraction shader to distort the view behind it
        const glass = createPrimitive("box", new pc.Vec3(1, 3, 0), new pc.Vec3(10, 10, 10), new pc.Color(1, 1, 1));
        glass.render.castShadows = false;
        glass.render.receiveShadows = false;

        // @ts-ignore create shader using vertex and fragment shaders
        const webgl2def = (app.graphicsDevice.webgl2) ? "#define GL2\n" : "";
        const shaderDefinition = {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION,
                aUv: pc.SEMANTIC_TEXCOORD0
            },
            vshader: assets['shader.vert'].data,
            fshader: webgl2def + assets['shader.frag'].data
        };

        // reflection material using the shader
        const refractionMaterial = new pc.Material();
        refractionMaterial.shader = new pc.Shader(app.graphicsDevice, shaderDefinition);
        glass.render.material = refractionMaterial;

        // set an offset map on the material
        refractionMaterial.setParameter('uOffsetMap', assets.normal.resource);

        // set roughness map
        refractionMaterial.setParameter('uRoughnessMap', assets.roughness.resource);

        refractionMaterial.update();
        app.start();

        // update things each frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // rotate the primitives
            primitives.forEach((prim: pc.Entity) => {
                prim.rotate(0.3, 0.2, 0.1);
            });

            glass.rotate(-0.1, 0.1, -0.15);

            // orbit the camera
            camera.setLocalPosition(20 * Math.sin(time * 0.2), 7, 20 * Math.cos(time * 0.2));
            camera.lookAt(new pc.Vec3(0, 2, 0));
        });
    }
}

export default GrabPassExample;
