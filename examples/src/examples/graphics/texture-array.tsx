import * as pc from '../../../../';


class TextureArrayExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Texture Array';
    static FILES = {
        'shader.vert': /* glsl */
`#version 300 es
in vec3 aPosition;
in vec2 aUv0;
in float aIndex;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

out vec2 vUv0;
out float vIndex;

void main(void)
{
    vUv0 = aUv0;
    vIndex = aIndex;
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
}`,
        'shader.frag': /* glsl */
`#version 300 es
precision mediump float;

in vec2 vUv0;
in float vIndex;
out vec4 fragColor;

uniform mediump sampler2DArray uDiffuseMap;

void main(void)
{
    fragColor = texture(uDiffuseMap, vec3(vUv0, vIndex));
}`
    };


    example(canvas: HTMLCanvasElement, files: { 'shader.vert': string, 'shader.frag': string }): void {


        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});

        const assets = {
            'rockyTrail': new pc.Asset("rockyTrail", "texture", { url: "/static/assets/textures/rocky_trail_diff_1k.jpg" }),
            'rockBoulder': new pc.Asset("rockBoulder", "texture", { url: "/static/assets/textures/rock_boulder_cracked_diff_1k.jpg" }),
            'coastSand': new pc.Asset("coastSand", "texture", { url: "/static/assets/textures/coast_sand_rocks_02_diff_1k.jpg" }),
            'aerialRocks': new pc.Asset("aeralRocks", "texture", { url: "/static/assets/textures/aerial_rocks_02_diff_1k.jpg" })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {
            app.start();

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

            // Create directional light
            const light = new pc.Entity();
            light.addComponent('light', {
                type: 'directional'
            });
            light.setLocalEulerAngles(45, 0, 45);

            // Create the shader definition and shader from the vertex and fragment shaders
            const shaderDefinition = {
                attributes: {
                    aPosition: pc.SEMANTIC_POSITION,
                    aUv0: pc.SEMANTIC_TEXCOORD0,
                    aIndex: pc.SEMANTIC_ATTR15
                },
                vshader: files['shader.vert'],
                fshader: files['shader.frag']
            };
            const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

            const textureArrayOptions = {
                format: pc.PIXELFORMAT_R8_G8_B8_A8,
                width: 1024,
                height: 1024,
                array: true,
                arrayLength: 4, // number of textures
                magFilter: pc.FILTER_NEAREST,
                minFilter: pc.FILTER_NEAREST,
                mipmaps: false,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE,
                levels: [[
                    assets.rockyTrail.resource.getSource(),
                    assets.rockBoulder.resource.getSource(),
                    assets.aerialRocks.resource.getSource(),
                    assets.coastSand.resource.getSource()
                ]]
            };

            const textureArray = new pc.Texture(app.graphicsDevice, textureArrayOptions);
            textureArray.upload();

            // Create a new material with the new shader
            const material = new pc.Material();
            material.shader = shader;
            material.setParameter("uDiffuseMap", textureArray);
            material.update();

            // Create a torus shape
            const torus = pc.createTorus(app.graphicsDevice, {
                tubeRadius: 0.2,
                ringRadius: 0.3,
                segments: 50,
                sides: 40
            });
            const shape = new pc.Entity();
            shape.addComponent('render', {
                material: material,
                meshInstances: [new pc.MeshInstance(torus, material)]
            });
            shape.setPosition(0, 0, 0);
            shape.setLocalScale(2, 2, 2);

            // Create an Entity with a camera component
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.4, 0.45, 0.5)
            });

            // Adjust the camera position
            camera.translate(0, 0, 4);

            // Add the new Entities to the hierarchy
            app.root.addChild(light);
            app.root.addChild(shape);
            app.root.addChild(camera);

            // Set an update function on the app's update event
            let angle = 0;
            app.on("update", function (dt) {
                angle = (angle + dt * 10) % 360;

                // Rotate the boxes
                shape.setEulerAngles(angle, angle * 2, angle * 4);
            });
        });
    }
}

export default TextureArrayExample;
