import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { InfoBox, BindingTwoWay, LabelGroup, Panel, BooleanInput } = ReactPCUI;
    return fragment(
        jsx(InfoBox, {
            icon: 'E218',
            title: 'WebGL 1.0',
            text: 'Texture Arrays are not supported on WebGL 1.0 devices',
            hidden: !(pc.app?.graphicsDevice.isWebGL1 ?? false)
        }),
        jsx(Panel, { headerText: 'Texture Arrays' },
            jsx(LabelGroup, { text: 'Show mipmaps' },
                jsx(BooleanInput, {
                    type: "toggle",
                    binding: new BindingTwoWay(),
                    link: {
                        observer,
                        path: 'mipmaps'
                    }
                })
            )
        )
    );
}

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, data, files, assetPath, scriptsPath, glslangPath, twgslPath }) {
    function generateMipmaps(width, height) {
        const colors = [
            [0, 128, 0], // Green
            [255, 255, 0], // Yellow
            [255, 165, 0], // Orange
            [255, 0, 0], // Red
            [0, 0, 255], // Blue
            [75, 0, 130], // Indigo
            [238, 130, 238], // Violet
            [255, 192, 203], // Pink
            [165, 42, 42], // Brown
            [128, 128, 128], // Gray
            [128, 0, 128], // Purple
            [0, 128, 128], // Teal
            [0, 0, 0], // Black
            [255, 255, 255] // White
        ];

        const mipmapLevels = Math.log2(Math.max(width, height)) + 1;
        const levels = [];
        for (let i = 0; i < mipmapLevels; i++) {
            const levelWidth = width >> i;
            const levelHeight = height >> i;

            const data = new Uint8Array(levelWidth * levelHeight * 4);
            levels.push(data);

            const color = colors[i % colors.length];

            for (let j = 0; j < levelWidth * levelHeight; j++) {
                data[j * 4 + 0] = color[0];
                data[j * 4 + 1] = color[1];
                data[j * 4 + 2] = color[2];
                data[j * 4 + 3] = 255;
            }
        }
        return levels;
    }

    const assets = {
        rockyTrail: new pc.Asset("rockyTrail", "texture", { url: assetPath + "textures/rocky_trail_diff_1k.jpg" }),
        rockBoulder: new pc.Asset("rockBoulder", "texture", { url: assetPath + "textures/rock_boulder_cracked_diff_1k.jpg" }),
        coastSand: new pc.Asset("coastSand", "texture", { url: assetPath + "textures/coast_sand_rocks_02_diff_1k.jpg" }),
        aerialRocks: new pc.Asset("aeralRocks", "texture", { url: assetPath + "textures/aerial_rocks_02_diff_1k.jpg" }),
        script: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' })
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
    createOptions.keyboard = new pc.Keyboard(document.body);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler
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

        if (app.graphicsDevice.isWebGL1) {
            return app;
        }

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create directional light
        const light = new pc.Entity();
        light.addComponent('light', {
            type: 'directional'
        });
        light.setLocalEulerAngles(45, 0, 45);

        // Create the shader definition and shader from the vertex and fragment shaders
        const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
            aPosition: pc.SEMANTIC_POSITION,
            aUv0: pc.SEMANTIC_TEXCOORD0,
            aNormal: pc.SEMANTIC_NORMAL
        });

        const shaderGround = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['ground.frag'], 'groundsShader', {
            aPosition: pc.SEMANTIC_POSITION,
            aUv0: pc.SEMANTIC_TEXCOORD0,
            aNormal: pc.SEMANTIC_NORMAL
        });

        const textureArrayOptions = {
            name: 'textureArrayImages',
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            width: 1024,
            height: 1024,
            arrayLength: 4, // array texture with 4 textures
            magFilter: pc.FILTER_NEAREST,
            minFilter: pc.FILTER_NEAREST_MIPMAP_NEAREST,
            mipmaps: true,
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

        // generate mipmaps for visualization
        const mipmaps = generateMipmaps(textureArrayOptions.width, textureArrayOptions.height);
        const levels = mipmaps.map((data) => {
            const textures = [];
            for (let i = 0; i < textureArrayOptions.arrayLength; i++) {
                textures.push(data);
            }
            return textures;
        });
        textureArrayOptions.levels = levels;
        textureArrayOptions.name = 'textureArrayData';
        const mipmapTextureArray = new pc.Texture(app.graphicsDevice, textureArrayOptions);

        // Create a new material with the new shader
        const material = new pc.Material();
        material.shader = shader;
        material.setParameter("uDiffuseMap", textureArray);
        material.update();

        // Create a another material with the new shader
        const groundMaterial = new pc.Material();
        groundMaterial.shader = shaderGround;
        groundMaterial.cull = pc.CULLFACE_NONE;
        groundMaterial.setParameter("uDiffuseMap", textureArray);
        groundMaterial.update();

        // Create an Entity for the ground
        const ground = new pc.Entity();
        ground.addComponent("render", {
            type: "box",
            material: groundMaterial
        });
        ground.setLocalScale(4, 4, 4);
        ground.setLocalPosition(0, -7, 0);
        app.root.addChild(ground);

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
        shape.setPosition(0, -2, 0);
        shape.setLocalScale(4, 4, 4);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });

        // Adjust the camera position
        camera.translate(3, -2, 4);
        camera.lookAt(0, 0, 0);

        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2, // Override default of 0 (no inertia),
                distanceMax: 10.0
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");

        // Add the new Entities to the hierarchy
        app.root.addChild(light);
        app.root.addChild(shape);
        app.root.addChild(camera);

        // Set an update function on the app's update event
        let angle = 0;
        let time = 0;
        app.on("update", function (dt) {
            time += dt;
            angle = (angle + dt * 10) % 360;

            // Rotate the boxes
            shape.setEulerAngles(angle, angle * 2, angle * 4);
            shape.render.meshInstances[0].setParameter('uTime', time);
        });
        data.on('mipmaps:set', (/** @type {number} */ value) => {
            groundMaterial.setParameter("uDiffuseMap", value ? mipmapTextureArray : textureArray);
            material.setParameter("uDiffuseMap", value ? mipmapTextureArray : textureArray);
        });
    });
    return app;
}


export class TextureArrayExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;

    static FILES = {
        'shader.vert': /* glsl */`
            attribute vec3 aPosition;
            attribute vec2 aUv0;
            attribute vec3 aNormal;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            uniform mat3 matrix_normal;

            varying vec2 vUv0;
            varying vec3 worldNormal;

            void main(void)
            {
                vUv0 = aUv0;
                worldNormal = normalize(matrix_normal * aNormal);
                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
            }`,

        'shader.frag': /* glsl */`
            varying vec2 vUv0;
            varying vec3 worldNormal;
            uniform float uTime;

            uniform mediump sampler2DArray uDiffuseMap;

            void main(void)
            {
                // sample different texture based on time along its texture v-coordinate
                float index = (sin(uTime + vUv0.y + vUv0.x * 0.5) * 0.5 + 0.5) * 4.0;
                vec4 data = texture(uDiffuseMap, vec3(vUv0, floor(index)));

                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting
                gl_FragColor = vec4(data.rgb, 1.0);
            }`,

        'ground.frag': /* glsl */`
            varying vec2 vUv0;
            varying vec3 worldNormal;

            uniform mediump sampler2DArray uDiffuseMap;

            void main(void)
            {
                vec4 data = texture(uDiffuseMap, vec3(vUv0, step(vUv0.x, 0.5) + 2.0 * step(vUv0.y, 0.5)));
                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting
                gl_FragColor = vec4(data.rgb, 1.0);
            }`
    };
    static controls = controls;
    static example = example;
}
