import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'BLOOM [KEY_1]' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bloom.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bloom.bloomIntensity' }
                })
            ),
            jsx(LabelGroup, { text: 'threshold' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bloom.bloomThreshold' }
                })
            ),
            jsx(LabelGroup, { text: 'blur amount' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bloom.blurAmount' },
                    min: 1,
                    max: 30
                })
            )
        ),
        jsx(Panel, { headerText: 'SEPIA [KEY_2]' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.sepia.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'amount' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.sepia.amount' }
                })
            )
        ),
        jsx(Panel, { headerText: 'VIGNETTE [KEY_3]' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.vignette.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'darkness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.vignette.darkness' }
                })
            ),
            jsx(LabelGroup, { text: 'offset' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.vignette.offset' },
                    max: 2
                })
            )
        ),
        jsx(Panel, { headerText: 'BOKEH [KEY_4]' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bokeh.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'aperture' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bokeh.aperture' },
                    max: 0.2
                })
            ),
            jsx(LabelGroup, { text: 'max blur' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.bokeh.maxBlur' },
                    max: 0.1
                })
            )
        ),
        jsx(Panel, { headerText: 'SSAO [KEY_5]' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.radius' },
                    max: 10
                })
            ),
            jsx(LabelGroup, { text: 'samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.samples' },
                    max: 32
                })
            ),
            jsx(LabelGroup, { text: 'brightness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.brightness' }
                })
            ),
            jsx(LabelGroup, { text: 'downscale' },
                jsx(SelectInput, {
                    options: [
                        { v: 1, t: 'None' },
                        { v: 2, t: '50%' },
                        { v: '4', t: '25%' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'scripts.ssao.downscale' }
                })
            )
        ),
        jsx(Panel, { headerText: 'POST-PROCESS UI [KEY_6]' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.postProcessUI.enabled' }
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

    const assets = {
        board: new pc.Asset('statue', 'container', { url: assetPath + 'models/chess-board.glb' }),
        bloom: new pc.Asset('bloom', 'script', { url: scriptsPath + 'posteffects/posteffect-bloom.js' }),
        bokeh: new pc.Asset('bokeh', 'script', { url: scriptsPath + 'posteffects/posteffect-bokeh.js' }),
        sepia: new pc.Asset('sepia', 'script', { url: scriptsPath + 'posteffects/posteffect-sepia.js' }),
        vignette: new pc.Asset('vignette', 'script', { url: scriptsPath + 'posteffects/posteffect-vignette.js' }),
        ssao: new pc.Asset('ssao', 'script', { url: scriptsPath + 'posteffects/posteffect-ssao.js' }),
        font: new pc.Asset('font', 'font', { url: assetPath + 'fonts/arial.json' }),
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
    createOptions.keyboard = new pc.Keyboard(document.body);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem,
        pc.ScreenComponentSystem,
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
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.skyboxMip = 2;
        app.scene.exposure = 1;

        /**
         * helper function to create a 3d primitive including its material
         * @param {string} primitiveType - The primitive type.
         * @param {pc.Vec3} position - The position (unused).
         * @param {pc.Vec3} scale - The scale.
         * @param {number} brightness - The brightness (unused).
         * @param {boolean} [allowEmissive] - Allow emissive (unused).
         * @returns {pc.Entity} The returned entity.
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

export class PostEffectsExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}
