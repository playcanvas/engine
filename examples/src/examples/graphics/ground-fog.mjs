import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup } = ReactPCUI;
    return jsx(LabelGroup, { text: 'softness' },
        jsx(BooleanInput, {
            type: 'toggle',
            binding: new BindingTwoWay(),
            link: {
                observer,
                path: 'data.softness'
            }
        })
    )
}

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, files, assetPath, scriptsPath, glslangPath, twgslPath, data }) {

    const assets = {
        script: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' }),
        terrain: new pc.Asset('terrain', 'container', { url: assetPath + 'models/terrain.glb' }),
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        texture: new pc.Asset('color', 'texture', { url: assetPath + 'textures/clouds.jpg' })
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

        data.set('data', {
            softness: true
        });

        // setup skydome
        app.scene.skyboxMip = 3;
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -70, 0);
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // disable skydome rendering
        const skyLayer = app.scene.layers.getLayerById(pc.LAYERID_SKYBOX);
        skyLayer.enabled = false;

        // instantiate the terrain
        const terrain = assets.terrain.resource.instantiateRenderEntity();
        terrain.setLocalScale(30, 30, 30);
        app.root.addChild(terrain);

        // find a tree in the middle to use as a focus point
        const tree = terrain.findOne("name", "Arbol 2.002");

        // create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(150 / 255, 213 / 255, 63 / 255),
            farClip: 1000
        });

        // and position it in the world
        camera.setLocalPosition(-200, 120, 225);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: tree,
                distanceMax: 600
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        // enable the camera to render the scene's depth map.
        camera.camera.requestSceneDepthMap(true);

        // Create a directional light casting cascaded shadows
        const dirLight = new pc.Entity();
        dirLight.addComponent("light", {
            type: "directional",
            color: pc.Color.WHITE,
            shadowBias: 0.3,
            normalOffsetBias: 0.2,
            intensity: 1.0,

            // enable shadow casting
            castShadows: true,
            shadowDistance: 1000,
            shadowResolution: 2048,
            shadowType: pc.SHADOW_PCF3
        });
        app.root.addChild(dirLight);
        dirLight.setLocalEulerAngles(45, 350, 20);

        // create a custom fog shader
        // @ts-ignore
        const vertex = `#define VERTEXSHADER\n` + pc.shaderChunks.screenDepthPS + files['shader.vert'];
        // @ts-ignore
        const fragment = pc.shaderChunks.screenDepthPS + files['shader.frag'];
        const shader = pc.createShaderFromCode(app.graphicsDevice, vertex, fragment, 'GroundFogShader');

        // and set up a material using this shader
        const material = new pc.Material();
        material.shader = shader;
        material.setParameter('uTexture', assets.texture.resource);
        material.depthWrite = false;
        material.blendType = pc.BLEND_NORMAL;
        material.update();

        // create a subdivided plane mesh, to allow for vertex animation by the shader
        const mesh = pc.createPlane(app.graphicsDevice, { widthSegments: 20, lengthSegments: 20 });
        const meshInstance = new pc.MeshInstance(mesh, material);
        const ground = new pc.Entity();
        ground.addComponent("render", {
            meshInstances: [meshInstance],
            material: material,
            castShadows: false,
            receiveShadows: false
        });
        ground.setLocalScale(500, 1, 500);
        ground.setLocalPosition(0, 25, 0);
        app.root.addChild(ground);

        let firstFrame = true;
        let currentTime = 0;
        app.on("update", function (dt) {

            // on the first frame, when camera is updated, move it further away from the focus tree
            if (firstFrame) {
                firstFrame = false;
                // @ts-ignore engine-tsd
                camera.script.orbitCamera.distance = 320;
            }

            // Update the time and pass it to shader
            currentTime += dt;
            material.setParameter('uTime', currentTime);

            // based on sofness toggle, set shader parameter
            material.setParameter('uSoftening', data.get('data.softness') ? 50 : 1000);

            // debug rendering of the deptht texture in the corner
            app.drawDepthTexture(0.7, -0.7, 0.5, -0.5);
        });
    });
    return app;
}

export class GroundFogExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;

    static FILES = {
        'shader.vert': /* glsl */ `
            attribute vec3 vertex_position;
            attribute vec2 vertex_texCoord0;

            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            uniform float uTime;
            uniform sampler2D uTexture;

            varying vec2 texCoord0;
            varying vec2 texCoord1;
            varying vec2 texCoord2;
            varying vec4 screenPos;
            varying float depth;

            void main(void)
            {
                // 3 scrolling texture coordinates with different direction and speed
                texCoord0 = vertex_texCoord0 * 2.0 + vec2(uTime * 0.003, uTime * 0.01);
                texCoord1 = vertex_texCoord0 * 1.5 + vec2(uTime * -0.02, uTime * 0.02);
                texCoord2 = vertex_texCoord0 * 1.0 + vec2(uTime * 0.01, uTime * -0.003);

                // sample the fog texture to have elevation for this vertex
                vec2 offsetTexCoord = vertex_texCoord0 + vec2(uTime * 0.001, uTime * -0.0003);
                float offset = texture2D(uTexture, offsetTexCoord).r;

                // vertex in the world space
                vec4 pos = matrix_model * vec4(vertex_position, 1.0);

                // move it up based on the offset
                pos.y += offset * 25.0;

                // position in projected (screen) space
                vec4 projPos = matrix_viewProjection * pos;
                gl_Position = projPos;

                // the linear depth of the vertex (in camera space)
                depth = getLinearDepth(pos.xyz);

                // screen fragment position, used to sample the depth texture
                screenPos = projPos;
            }
        `,
        'shader.frag': /* glsl */ `
            uniform sampler2D uTexture;
            uniform float uSoftening;

            varying vec2 texCoord0;
            varying vec2 texCoord1;
            varying vec2 texCoord2;
            varying vec4 screenPos;
            varying float depth;
            
            void main(void)
            {
                // sample the texture 3 times and compute average intensity of the fog
                vec4 diffusTexture0 = texture2D (uTexture, texCoord0);
                vec4 diffusTexture1 = texture2D (uTexture, texCoord1);
                vec4 diffusTexture2 = texture2D (uTexture, texCoord2);
                float alpha = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r);

                // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
                vec2 screenCoord = getGrabScreenPos(screenPos);

                // read the depth from the depth buffer
                float sceneDepth = getLinearScreenDepth(screenCoord) * camera_params.x;

                // depth of the current fragment (on the fog plane)
                float fragmentDepth = depth * camera_params.x;

                // difference between these two depths is used to adjust the alpha, to fade out
                // the fog near the geometry
                float depthDiff = clamp(abs(fragmentDepth - sceneDepth) * uSoftening, 0.0, 1.0);
                alpha *= smoothstep(0.0, 1.0, depthDiff);

                // final color
                vec3 fogColor = vec3(1.0, 1.0, 1.0);
                gl_FragColor = vec4(fogColor, alpha);
            }
        `
    };
    static controls = controls;
    static example = example;
}
