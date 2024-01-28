import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SelectInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Debug Shader Rendering' },
            jsx(LabelGroup, { text: 'Mode' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.shaderPassName' },
                    type: "string",
                    options: [
                        { v: pc.SHADERPASS_FORWARD, t: 'None' },
                        { v: pc.SHADERPASS_ALBEDO, t: 'Albedo' },
                        { v: pc.SHADERPASS_OPACITY, t: 'Opacity' },
                        { v: pc.SHADERPASS_WORLDNORMAL, t: 'World Normal' },
                        { v: pc.SHADERPASS_SPECULARITY, t: 'Specularity' },
                        { v: pc.SHADERPASS_GLOSS, t: 'Gloss' },
                        { v: pc.SHADERPASS_METALNESS, t: 'Metalness' },
                        { v: pc.SHADERPASS_AO, t: 'AO' },
                        { v: pc.SHADERPASS_EMISSION, t: 'Emission' },
                        { v: pc.SHADERPASS_LIGHTING, t: 'Lighting' },
                        { v: pc.SHADERPASS_UV0, t: 'UV0' }
                    ]
                })
            )
        )
    );
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, data, assetPath, scriptsPath, glslangPath, twgslPath, dracoPath }) {

    // set up and load draco module, as the glb we load is draco compressed
    pc.WasmModule.setConfig('DracoDecoderModule', {
        glueUrl:     dracoPath + 'draco.wasm.js',
        wasmUrl:     dracoPath + 'draco.wasm.wasm',
        fallbackUrl: dracoPath + 'draco.js'
    });

    await new Promise((resolve) => { pc.WasmModule.getInstance('DracoDecoderModule', () => resolve()) });

    const assets = {
        script: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' }),
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        board: new pc.Asset('statue', 'container', { url: assetPath + 'models/chess-board.glb' })
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

        data.set('settings', {
            shaderPassName: pc.SHADERPASS_FORWARD
        });

        // get few existing layers and create a new layer for the spot light
        const worldLayer = app.scene.layers.getLayerByName("World");
        const skyboxLayer = app.scene.layers.getLayerByName("Skybox");
        const spotLightLayer = new pc.Layer({ name: "SpotLightLayer" });
        app.scene.layers.insert(spotLightLayer, 0);

        // get the instance of the chess board and set up with render component
        const boardEntity = assets.board.resource.instantiateRenderEntity({
            castShadows: true,
            receiveShadows: true,

            // add it to both layers with lights, as we want it to lit by directional light and spot light,
            // depending on the camera
            layers: [worldLayer.id, spotLightLayer.id]
        });
        app.root.addChild(boardEntity);

        // Create left camera, using default layers (including the World)
        const cameraLeft = new pc.Entity('LeftCamera');
        cameraLeft.addComponent("camera", {
            farClip: 500,
            rect: new pc.Vec4(0, 0, 0.5, 0.5)
        });
        app.root.addChild(cameraLeft);

        // Create right orthographic camera, using spot light layer and skybox layer,
        // so that it receives the light from the spot light but not from the directional light
        const cameraRight = new pc.Entity('RightCamera');
        cameraRight.addComponent("camera", {
            layers: [spotLightLayer.id, skyboxLayer.id],
            farClip: 500,
            rect: new pc.Vec4(0.5, 0, 0.5, 0.5),
            projection: pc.PROJECTION_ORTHOGRAPHIC,
            orthoHeight: 150
        });
        cameraRight.translate(0, 150, 0);
        cameraRight.lookAt(pc.Vec3.ZERO, pc.Vec3.RIGHT);
        app.root.addChild(cameraRight);

        // Create top camera, using default layers (including the World)
        const cameraTop = new pc.Entity('TopCamera');
        cameraTop.addComponent("camera", {
            farClip: 500,
            rect: new pc.Vec4(0, 0.5, 1, 0.5)
        });
        cameraTop.translate(-100, 75, 100);
        cameraTop.lookAt(0, 7, 0);
        app.root.addChild(cameraTop);

        // add orbit camera script with a mouse and a touch support
        cameraTop.addComponent("script");
        cameraTop.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: app.root,
                distanceMax: 300,
                frameOnStart: false
            }
        });
        cameraTop.script.create("orbitCameraInputMouse");
        cameraTop.script.create("orbitCameraInputTouch");

        // Create a directional light which casts shadows
        const dirLight = new pc.Entity();
        dirLight.addComponent("light", {
            type: "directional",
            layers: [worldLayer.id],
            color: pc.Color.WHITE,
            intensity: 5,
            range: 500,
            shadowDistance: 500,
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.05
        });
        app.root.addChild(dirLight);
        dirLight.setLocalEulerAngles(45, 0, 30);

        // Create a single directional light which casts shadows
        const spotLight = new pc.Entity();
        spotLight.addComponent("light", {
            type: "spot",
            layers: [spotLightLayer.id],
            color: pc.Color.YELLOW,
            intensity: 7,
            innerConeAngle: 20,
            outerConeAngle: 80,
            range: 200,
            shadowDistance: 200,
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.05
        });
        app.root.addChild(spotLight);

        // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;

        // handle HUD changes - update the debug mode for the top and right cameras
        data.on('*:set', (/** @type {string} */ path, value) => {
            cameraTop.camera.setShaderPass(value);
            cameraRight.camera.setShaderPass(value);
        });

        // update function called once per frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // orbit camera left around
            cameraLeft.setLocalPosition(100 * Math.sin(time * 0.2), 35, 100 * Math.cos(time * 0.2));
            cameraLeft.lookAt(pc.Vec3.ZERO);

            // move the spot light around
            spotLight.setLocalPosition(40 * Math.sin(time * 0.5), 60, 40 * Math.cos(time * 0.5));

            // zoom in and out the orthographic camera
            cameraRight.camera.orthoHeight = 90 + Math.sin(time * 0.3) * 60;
        });
    });
    return app;
}

export class MultiViewExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
};
