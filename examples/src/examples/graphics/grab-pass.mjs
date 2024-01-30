import * as pc from 'playcanvas';

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, files, assetPath, glslangPath, twgslPath }) {

    const assets = {
        normal: new pc.Asset('normal', 'texture', { url: assetPath + 'textures/normal-map.png' }),
        roughness: new pc.Asset("roughness", "texture", { url: assetPath + "textures/pc-gray.png" }),
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.touch = new pc.TouchDevice(document.body);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        // setup skydome
        app.scene.skyboxMip = 0;
        app.scene.exposure = 2;
        app.scene.envAtlas = assets.helipad.resource;

        app.scene.toneMapping = pc.TONEMAP_ACES;

        // Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
        // Move the depth layer to take place after World and Skydome layers, to capture both of them.
        const depthLayer = app.scene.layers.getLayerById(pc.LAYERID_DEPTH);
        app.scene.layers.remove(depthLayer);
        app.scene.layers.insertOpaque(depthLayer, 2);

        /**
         * helper function to create a primitive with shape type, position, scale, color
         * @param {string} primitiveType - The primitive type.
         * @param {pc.Vec3} position - The position.
         * @param {pc.Vec3} scale - The scale.
         * @param {pc.Color} color - The color.
         * @returns {pc.Entity}
         */
        function createPrimitive(primitiveType, position, scale, color) {
            // create material of specified color
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            material.gloss = 0.6;
            material.metalness = 0.4;
            material.useMetalness = true;
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

        /**
         * create few primitives, keep their references to rotate them later
         * @type {pc.Entity[]}
         */
        const primitives = [];
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
        const camera = new pc.Entity("SceneCamera");
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });
        app.root.addChild(camera);
        camera.setLocalPosition(0, 10, 20);
        camera.lookAt(pc.Vec3.ZERO);

        // enable the camera to render the scene's color map.
        camera.camera.requestSceneColorMap(true);

        // create a primitive which uses refraction shader to distort the view behind it
        const glass = createPrimitive("box", new pc.Vec3(1, 3, 0), new pc.Vec3(10, 10, 10), new pc.Color(1, 1, 1));
        glass.render.castShadows = false;
        glass.render.receiveShadows = false;

        const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader');

        // reflection material using the shader
        const refractionMaterial = new pc.Material();
        refractionMaterial.shader = shader;
        glass.render.material = refractionMaterial;

        // set an offset map on the material
        refractionMaterial.setParameter('uOffsetMap', assets.normal.resource);

        // set roughness map
        refractionMaterial.setParameter('uRoughnessMap', assets.roughness.resource);

        // tint colors
        refractionMaterial.setParameter('tints[0]', new Float32Array([
            1, 0.7, 0.7,    // red
            1, 1, 1,        // white
            0.7, 0.7, 1,    // blue
            1, 1, 1         // white
        ]));

        // transparency
        refractionMaterial.blendType = pc.BLEND_NORMAL;
        refractionMaterial.update();

        // update things each frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // rotate the primitives
            primitives.forEach((prim) => {
                prim.rotate(0.3, 0.2, 0.1);
            });

            glass.rotate(-0.1, 0.1, -0.15);

            // orbit the camera
            camera.setLocalPosition(20 * Math.sin(time * 0.2), 7, 20 * Math.cos(time * 0.2));
            camera.lookAt(new pc.Vec3(0, 2, 0));
        });
    });
    return app;
}

export class GrabPassExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;

    static FILES = {
        'shader.vert': /* glsl */`
            attribute vec3 vertex_position;
            attribute vec2 vertex_texCoord0;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;

            varying vec2 texCoord;

            void main(void)
            {
                // project the position
                vec4 pos = matrix_model * vec4(vertex_position, 1.0);
                gl_Position = matrix_viewProjection * pos;

                texCoord = vertex_texCoord0;
            }
        `,
        'shader.frag': /* glsl */`
            // use the special uSceneColorMap texture, which is a built-in texture containing
            // a copy of the color buffer at the point of capture, inside the Depth layer.
            uniform sampler2D uSceneColorMap;

            // normal map providing offsets
            uniform sampler2D uOffsetMap;

            // roughness map
            uniform sampler2D uRoughnessMap;

            // tint colors
            uniform vec3 tints[4];

            // engine built-in constant storing render target size in .xy and inverse size in .zw
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
                vec3 grabColor = texture2DLodEXT(uSceneColorMap, grabUv + offset, mipmap).rgb;

                // tint the material based on mipmap, on WebGL2 only, as WebGL1 does not support non-constant array indexing
                // (note - this could be worked around by using a series of if statements in this case)
                #ifdef GL2
                    float tintIndex = clamp(mipmap, 0.0, 3.0);
                    grabColor *= tints[int(tintIndex)];
                #endif

                // brighten the refracted texture a little bit
                // brighten even more the rough parts of the glass
                gl_FragColor = vec4(grabColor * 1.1, 1.0) + roughness * 0.09;
            }
        `
    };
    static example = example;
}
