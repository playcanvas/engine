import React from 'react';
import * as pc from 'playcanvas';

import { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

export class PostEffectsExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Post Effects';
    static WEBGPU_ENABLED = true;

    /**
     * @param {Observer} data todo
     * @returns {JSX.Element} todo
     */
    static controls(data) {
        return React.createElement(React.Fragment, null,
            React.createElement(Panel, { headerText: 'BLOOM [KEY_1]' },
                React.createElement(LabelGroup, { text: 'enabled' },
                    React.createElement(BooleanInput, { type: 'toggle', binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.bloom.enabled' } })),
                React.createElement(LabelGroup, { text: 'intensity' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.bloom.bloomIntensity' } })),
                React.createElement(LabelGroup, { text: 'threshold' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.bloom.bloomThreshold' } })),
                React.createElement(LabelGroup, { text: 'blur amount' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.bloom.blurAmount' }, min: 1, max: 30 }))),
            React.createElement(Panel, { headerText: 'SEPIA [KEY_2]' },
                React.createElement(LabelGroup, { text: 'enabled' },
                    React.createElement(BooleanInput, { type: 'toggle', binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.sepia.enabled' } })),
                React.createElement(LabelGroup, { text: 'amount' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.sepia.amount' } }))),
            React.createElement(Panel, { headerText: 'VIGNETTE [KEY_3]' },
                React.createElement(LabelGroup, { text: 'enabled' },
                    React.createElement(BooleanInput, { type: 'toggle', binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.vignette.enabled' } })),
                React.createElement(LabelGroup, { text: 'darkness' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.vignette.darkness' } })),
                React.createElement(LabelGroup, { text: 'offset' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.vignette.offset' }, max: 2 }))),
            React.createElement(Panel, { headerText: 'BOKEH [KEY_4]' },
                React.createElement(LabelGroup, { text: 'enabled' },
                    React.createElement(BooleanInput, { type: 'toggle', binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.bokeh.enabled' } })),
                React.createElement(LabelGroup, { text: 'aperture' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.bokeh.aperture' }, max: 0.2 })),
                React.createElement(LabelGroup, { text: 'max blur' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.bokeh.maxBlur' }, max: 0.1 }))),
            React.createElement(Panel, { headerText: 'SSAO [KEY_5]' },
                React.createElement(LabelGroup, { text: 'enabled' },
                    React.createElement(BooleanInput, { type: 'toggle', binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.enabled' } })),
                React.createElement(LabelGroup, { text: 'radius' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.radius' }, max: 10 })),
                React.createElement(LabelGroup, { text: 'samples' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.samples' }, max: 32 })),
                React.createElement(LabelGroup, { text: 'brightness' },
                    React.createElement(SliderInput, { binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.brightness' } })),
                React.createElement(LabelGroup, { text: 'downscale' },
                    React.createElement(SelectInput, { options: [{ v: 1, t: 'None' }, { v: 2, t: '50%' }, { v: '4', t: '25%' }], binding: new BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.downscale' } }))),
            React.createElement(Panel, { headerText: 'POST-PROCESS UI [KEY_6]' },
                React.createElement(LabelGroup, { text: 'enabled' },
                    React.createElement(BooleanInput, { type: 'toggle', binding: new BindingTwoWay(), link: { observer: data, path: 'data.postProcessUI.enabled' } }))));
    }

        /**
     * @param {HTMLCanvasElement} canvas - todo
     * @param {string} deviceType - todo
     * @param {any} data - todo
     * @returns {Promise<pc.AppBase>} todo
     */    
    static async example(canvas, deviceType, data) {

        // set up and load draco module, as the glb we load is draco compressed
        pc.WasmModule.setConfig('DracoDecoderModule', {
            glueUrl: '/static/lib/draco/draco.wasm.js',
            wasmUrl: '/static/lib/draco/draco.wasm.wasm',
            fallbackUrl: '/static/lib/draco/draco.js'
        });

        const assets = {
            'board': new pc.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' }),
            'bloom': new pc.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' }),
            'bokeh': new pc.Asset('bokeh', 'script', { url: '/static/scripts/posteffects/posteffect-bokeh.js' }),
            'sepia': new pc.Asset('sepia', 'script', { url: '/static/scripts/posteffects/posteffect-sepia.js' }),
            'vignette': new pc.Asset('vignette', 'script', { url: '/static/scripts/posteffects/posteffect-vignette.js' }),
            'ssao': new pc.Asset('ssao', 'script', { url: '/static/scripts/posteffects/posteffect-ssao.js' }),
            'font': new pc.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false })
        };

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js',

            // WebGPU does not currently support antialiased depth resolve, disable it till we implement a shader resolve solution
            antialias: false
        };

        const device = await pc.createGraphicsDevice(canvas, gfxOptions);
        const createOptions = new pc.AppOptions();
        createOptions.graphicsDevice = device;
        createOptions.keyboard = new pc.Keyboard(document.body);

        createOptions.componentSystems = [
            // @ts-ignore
            pc.RenderComponentSystem,
            // @ts-ignore
            pc.CameraComponentSystem,
            // @ts-ignore
            pc.LightComponentSystem,
            // @ts-ignore
            pc.ScriptComponentSystem,
            // @ts-ignore
            pc.ScreenComponentSystem,
            // @ts-ignore
            pc.ElementComponentSystem
        ];
        createOptions.resourceHandlers = [
            // @ts-ignore
            pc.ScriptHandler,
            // @ts-ignore
            pc.TextureHandler,
            // @ts-ignore
            pc.ContainerHandler,
            // @ts-ignore
            pc.FontHandler
        ];

        const app = new pc.AppBase(canvas);
        app.init(createOptions);

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            app.start();

            // setup skydome
            app.scene.envAtlas = assets.helipad.resource;
            app.scene.skyboxMip = 2;
            app.scene.exposure = 1;

            /**
             * helper function to create a 3d primitive including its material
             * @param {string} primitiveType - todo
             * @param {pc.Vec3} position - todo
             * @param {pc.Vec3} scale - todo
             * @param {number} brightness - todo
             * @param {boolean} [allowEmissive] - todo
             * @returns {pc.Entity}
             */
            function createPrimitive(primitiveType, position, scale, brightness, allowEmissive = true) {

                // create a material
                const material = new pc.StandardMaterial();
                material.gloss = 0.4;
                material.metalness = 0.6;
                material.useMetalness = true;
                material.emissive = pc.Color.YELLOW;
                material.update();

                // create the primitive using the material
                const primitive = new pc.Entity();
                primitive.addComponent('render', {
                    type: primitiveType,
                    material: material,
                    castShadows: false,
                    receiveShadows: false
                });

                // set scale and add it to scene
                primitive.setLocalScale(scale);
                app.root.addChild(primitive);

                return primitive;
            }

            // get the instance of the chess board and set up with render component
            const boardEntity = assets.board.resource.instantiateRenderEntity({
                castShadows: true,
                receiveShadows: true
            });
            app.root.addChild(boardEntity);

            // create a sphere which represents the point of focus for the bokeh filter
            const focusPrimitive = createPrimitive("sphere", pc.Vec3.ZERO, new pc.Vec3(3, 3, 3), 1.5, false);

            // add an omni light as a child of this sphere
            const light = new pc.Entity();
            light.addComponent("light", {
                type: "omni",
                color: pc.Color.YELLOW,
                intensity: 2,
                range: 150,
                shadowDistance: 150,
                castShadows: true
            });
            focusPrimitive.addChild(light);

            // Create an Entity with a camera component, and attach postprocessing effects scripts on it
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.4, 0.45, 0.5),
                farClip: 500
            });
            camera.addComponent("script");
            data.set('scripts', {
                ssao: {
                    enabled: true,
                    radius: 5,
                    samples: 16,
                    brightness: 0,
                    downscale: 1
                },
                bloom: {
                    enabled: true,
                    bloomIntensity: 0.8,
                    bloomThreshold: 0.7,
                    blurAmount: 15
                },
                sepia: {
                    enabled: true,
                    amount: 0.4
                },
                vignette: {
                    enabled: true,
                    darkness: 1,
                    offset: 1.2
                },
                bokeh: {
                    enabled: true,
                    aperture: 0.1,
                    maxBlur: 0.02
                }
            });

            Object.keys(data.get('scripts')).forEach((key) => {
                camera.script.create(key, {
                    attributes: data.get(`scripts.${key}`)
                });
            });

            // position the camera in the world
            camera.setLocalPosition(0, 30, -60);
            camera.lookAt(0, 0, 100);
            app.root.addChild(camera);

            // Allow user to toggle individual post effects
            app.keyboard.on("keydown", function (e) {
                // if the user is editing an input field, ignore key presses
                if (e.element.constructor.name === 'HTMLInputElement') return;
                switch (e.key) {
                    case pc.KEY_1:
                        data.set('scripts.bloom.enabled', !data.get('scripts.bloom.enabled'));
                        break;
                    case pc.KEY_2:
                        data.set('scripts.sepia.enabled', !data.get('scripts.sepia.enabled'));
                        break;
                    case pc.KEY_3:
                        data.set('scripts.vignette.enabled', !data.get('scripts.vignette.enabled'));
                        break;
                    case pc.KEY_4:
                        data.set('scripts.bokeh.enabled', !data.get('scripts.bokeh.enabled'));
                        break;
                    case pc.KEY_5:
                        data.set('scripts.ssao.enabled', !data.get('scripts.ssao.enabled'));
                        break;
                    case pc.KEY_6:
                        data.set('data.postProcessUI.enabled', !data.get('data.postProcessUI.enabled'));
                        break;
                }
            }, this);

            // Create a 2D screen to place UI on
            const screen = new pc.Entity();
            screen.addComponent("screen", {
                referenceResolution: new pc.Vec2(1280, 720),
                scaleBlend: 0.5,
                scaleMode: pc.SCALEMODE_BLEND,
                screenSpace: true
            });
            app.root.addChild(screen);

            // create a text element to show which effects are enabled
            const text = new pc.Entity();
            text.addComponent("element", {
                anchor: new pc.Vec4(0.1, 0.1, 0.5, 0.5),
                fontAsset: assets.font,
                fontSize: 28,
                pivot: new pc.Vec2(0.5, 0.1),
                type: pc.ELEMENTTYPE_TEXT,
                alignment: pc.Vec2.ZERO
            });
            screen.addChild(text);

            // Display some UI text which the post processing can be tested against
            text.element.text = 'Test UI Text';

            // update things every frame
            let angle = 0;
            app.on("update", function (/** @type {number} */dt) {
                angle += dt;

                // rotate the skydome
                app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, angle * 20, 0);

                // move the focus sphere in the world
                const focusPosition = new pc.Vec3(0, 30, Math.sin(1 + angle * 0.3) * 90);
                focusPrimitive.setPosition(focusPosition);

                // set the focus distance to the bokeh effect
                // - it's a negative distance between the camera and the focus sphere
                camera.script.bokeh.focus = -focusPosition.sub(camera.getPosition()).length();

                // orbit the camera around
                camera.setLocalPosition(110 * Math.sin(angle * 0.2), 45, 110 * Math.cos(angle * 0.2));
                focusPosition.y -= 20;
                camera.lookAt(focusPosition);

                // display the depth texture if it was rendered
                if (data.get('scripts.bokeh.enabled') || data.get('scripts.ssao.enabled')) {
                    // @ts-ignore engine-tsd
                    app.drawDepthTexture(0.7, -0.7, 0.5, -0.5);
                }
            });

            data.on('*:set', (/** @type {string} */ path, value) => {
                const pathArray = path.split('.');
                if (pathArray[0] === 'scripts') {
                    camera.script[pathArray[1]][pathArray[2]] = value;
                } else {
                    camera.camera.disablePostEffectsLayer = camera.camera.disablePostEffectsLayer === pc.LAYERID_UI ? undefined : pc.LAYERID_UI;
                }
            });
        });
        return app;
    }
}
