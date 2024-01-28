import * as pc from 'playcanvas';

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, files, scriptsPath, assetPath, glslangPath, twgslPath }) {
    const assets = {
        envatlas: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        statue: new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' }),
        script: new pc.Asset('script', 'script', { url: scriptsPath + 'utils/planar-renderer.js' })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ScriptHandler,
        // @ts-ignore
        pc.ContainerHandler
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

        // set up some general scene rendering properties
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // setup skydome
        app.scene.envAtlas = assets.envatlas.resource;
        app.scene.skyboxMip = 1;
        app.scene.skyboxIntensity = 1.7;  // make it brighter

        /**
         * helper function to create a primitive with shape type, position, scale, color and layer
         * @param {string} primitiveType 
         * @param {pc.Vec3} position 
         * @param {pc.Vec3} scale 
         * @param {pc.Color} color 
         * @param {number[]} layer 
         * @param {pc.Material | pc.StandardMaterial | null} [material] 
         * @returns 
         */
        function createPrimitive(primitiveType, position, scale, color, layer, material = null) {

            // create material of specified color
            if (!material) {
                const standardMaterial = new pc.StandardMaterial();
                standardMaterial.diffuse = color;
                standardMaterial.gloss = 0.6;
                standardMaterial.metalness = 0.7;
                standardMaterial.useMetalness = true;
                standardMaterial.update();
                material = standardMaterial;
            }

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                layers: layer,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // get existing layers
        const worldLayer = app.scene.layers.getLayerByName("World");
        const skyboxLayer = app.scene.layers.getLayerByName("Skybox");
        const uiLayer = app.scene.layers.getLayerByName("UI");

        // create a layer for objects that do not render into texture
        const excludedLayer = new pc.Layer({ name: "Excluded" });
        app.scene.layers.insert(excludedLayer, app.scene.layers.getTransparentIndex(worldLayer) + 1);

        // Create the shader from the vertex and fragment shaders
        const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
            aPosition: pc.SEMANTIC_POSITION,
            aUv0: pc.SEMANTIC_TEXCOORD0
        });

        // reflective ground
        // This is in the excluded layer so it does not render into reflection texture
        const groundMaterial = new pc.Material();
        groundMaterial.shader = shader;
        createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(40, 1, 40), new pc.Color(0.5, 0.5, 0.5), [excludedLayer.id], groundMaterial);

        // get the instance of the statue and set up with render component
        const statueEntity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(statueEntity);

        /**
         * create few random primitives in the world layer
         * @type {pc.Entity[]}
         */
        const entities = [];
        const shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
        for (let i = 0; i < 6; i++) {
            const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
            const color = new pc.Color(Math.random(), Math.random(), Math.random());
            entities.push(createPrimitive(shapeName, pc.Vec3.ZERO, new pc.Vec3(3, 3, 3), color, [worldLayer.id]));
        }

        // Create main camera, which renders entities in world, excluded and skybox layers
        const camera = new pc.Entity("MainCamera");
        camera.addComponent("camera", {
            fov: 60,
            layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id, uiLayer.id]
        });
        app.root.addChild(camera);

        // create reflection camera, which renders entities in world and skybox layers only
        const reflectionCamera = new pc.Entity("ReflectionCamera");
        reflectionCamera.addComponent("camera", {
            fov: 60,
            layers: [worldLayer.id, skyboxLayer.id],
            priority: -1    // render reflections before the main camera
        });

        // add planarRenderer script which renders the reflection texture
        reflectionCamera.addComponent('script');
        reflectionCamera.script.create('planarRenderer', {
            attributes: {
                sceneCameraEntity: camera,
                scale: 1,
                mipmaps: false,
                depth: true,
                planePoint: pc.Vec3.ZERO,
                planeNormal: pc.Vec3.UP
            }
        });
        app.root.addChild(reflectionCamera);

        // update things each frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // rotate primitives around their center and also orbit them around the shiny sphere
            for (let e = 0; e < entities.length; e++) {
                const scale = (e + 1) / entities.length;
                const offset = time + e * 200;
                entities[e].setLocalPosition(7 * Math.sin(offset), e + 5, 7 * Math.cos(offset));
                entities[e].rotate(1 * scale, 2 * scale, 3 * scale);
            }

            // slowly orbit camera around
            camera.setLocalPosition(30 * Math.cos(time * 0.2), 10, 30 * Math.sin(time * 0.2));
            camera.lookAt(pc.Vec3.ZERO);

            // animate FOV
            camera.camera.fov = 60 + 20 * Math.sin(time * 0.5);

            // trigger reflection camera update (must be called after all parameters of the main camera are updated)
            // @ts-ignore engine-tsd
            const reflectionTexture = reflectionCamera.script.planarRenderer.frameUpdate();
            groundMaterial.setParameter('uDiffuseMap', reflectionTexture);
            groundMaterial.update();
        });
    });
    return app;
}

export class ReflectionPlanarExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;

    static FILES = {
        'shader.vert': /* glsl */`
            attribute vec3 aPosition;
            attribute vec2 aUv0;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;

            void main(void)
            {
                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);;
            }`,

        'shader.frag': /* glsl */`

            // engine built-in constant storing render target size in .xy and inverse size in .zw
            uniform vec4 uScreenSize;

            // reflection texture
            uniform sampler2D uDiffuseMap;

            void main(void)
            {
                // sample reflection texture
                vec2 coord = gl_FragCoord.xy * uScreenSize.zw;
                coord.y = 1.0 - coord.y;
                vec4 reflection = texture2D(uDiffuseMap, coord);

                gl_FragColor = vec4(reflection.xyz * 0.7, 1);
            }`
    };
    static example = example;
}
