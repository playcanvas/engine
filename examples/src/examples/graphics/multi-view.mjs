import React from 'react';
import * as pc from 'playcanvas';
import { BindingTwoWay, LabelGroup, Panel, SelectInput } from '@playcanvas/pcui/react';
import { assetPath, dracoPath } from '../../assetPath.mjs';
import { jsx } from '../../app/jsx.mjs';

/**
 * @param {{observer: import('@playcanvas/observer').Observer}} props - todo
 * @returns {JSX.Element} todo
 */
function controls({observer}) {
    return jsx(React.Fragment, null,
        React.createElement(Panel, { headerText: 'Debug Shader Rendering' }, React.createElement(LabelGroup, { text: 'Mode' },
            React.createElement(SelectInput, {
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
                ] })
            )
        )
    );
}

/**
 * @param {HTMLCanvasElement} canvas - todo
 * @param {string} deviceType - todo
 * @param {any} data - todo
 * @returns {Promise<pc.AppBase>} todo
 */    
async function example(canvas, deviceType, data) {

    // set up and load draco module, as the glb we load is draco compressed
    pc.WasmModule.setConfig('DracoDecoderModule', {
        glueUrl:     dracoPath + 'draco.wasm.js',
        wasmUrl:     dracoPath + 'draco.wasm.wasm',
        fallbackUrl: dracoPath + 'draco.js'
    });

    await new Promise((resolve) => { pc.WasmModule.getInstance('DracoDecoderModule', () => resolve()) });

    const assets = {
        'script': new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' }),
        'helipad': new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        'board': new pc.Asset('statue', 'container', { url: assetPath + 'models/chess-board.glb' })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: '/static/lib/glslang/glslang.js',
        twgslUrl: '/static/lib/twgsl/twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.touch = new pc.TouchDevice(document.body);

    createOptions.componentSystems = [
        // @ts-ignore
        pc.RenderComponentSystem,
        // @ts-ignore
        pc.CameraComponentSystem,
        // @ts-ignore
        pc.LightComponentSystem,
        // @ts-ignore
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

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        data.set('settings', {
            shaderPassName: pc.SHADERPASS_FORWARD
        });

        // get the instance of the chess board and set up with render component
        const boardEntity = assets.board.resource.instantiateRenderEntity({
            castShadows: true,
            receiveShadows: true
        });
        app.root.addChild(boardEntity);

        // Create left camera
        const cameraLeft = new pc.Entity('LeftCamera');
        cameraLeft.addComponent("camera", {
            farClip: 500,
            rect: new pc.Vec4(0, 0, 0.5, 0.5)
        });
        app.root.addChild(cameraLeft);

        // Create right orthographic camera
        const cameraRight = new pc.Entity('RightCamera');
        cameraRight.addComponent("camera", {
            farClip: 500,
            rect: new pc.Vec4(0.5, 0, 0.5, 0.5),
            projection: pc.PROJECTION_ORTHOGRAPHIC,
            orthoHeight: 150
        });
        cameraRight.translate(0, 150, 0);
        cameraRight.lookAt(pc.Vec3.ZERO, pc.Vec3.RIGHT);
        app.root.addChild(cameraRight);

        // Create top camera
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

        // Create a single directional light which casts shadows
        const dirLight = new pc.Entity();
        dirLight.addComponent("light", {
            type: "directional",
            color: pc.Color.WHITE,
            intensity: 2,
            range: 500,
            shadowDistance: 500,
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.05
        });
        app.root.addChild(dirLight);
        dirLight.setLocalEulerAngles(45, 0, 30);

        // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;

        // handle HUD changes - update the debug mode on the top camera
        data.on('*:set', (/** @type {string} */ path, value) => {
            cameraTop.camera.setShaderPass(value);
        });

        // update function called once per frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // orbit camera left around
            cameraLeft.setLocalPosition(100 * Math.sin(time * 0.2), 35, 100 * Math.cos(time * 0.2));
            cameraLeft.lookAt(pc.Vec3.ZERO);

            // zoom in and out the orthographic camera
            cameraRight.camera.orthoHeight = 90 + Math.sin(time * 0.3) * 60;
        });
    });
    return app;
}

export class MultiViewExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Multi View';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
};
