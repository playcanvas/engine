import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Scene Rendering' },
            jsx(LabelGroup, { text: 'resolution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.scale' },
                    min: 0.2,
                    max: 1,
                    precision: 1
                })
            ),
            jsx(LabelGroup, { text: 'background' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.background' },
                    min: 0,
                    max: 50,
                    precision: 1
                })
            ),
            jsx(LabelGroup, { text: 'emissive' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.emissive' },
                    min: 0,
                    max: 400,
                    precision: 1
                })
            ),
            jsx(LabelGroup, { text: 'Tonemapping' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.tonemapping' },
                    type: "number",
                    options: [
                        { v: pc.TONEMAP_LINEAR, t: 'LINEAR' },
                        { v: pc.TONEMAP_FILMIC, t: 'FILMIC' },
                        { v: pc.TONEMAP_HEJL, t: 'HEJL' },
                        { v: pc.TONEMAP_ACES, t: 'ACES' },
                        { v: pc.TONEMAP_ACES2, t: 'ACES2' }
                    ]
                })
            )
        ),
        jsx(Panel, { headerText: 'BLOOM' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.intensity' },
                    min: 0,
                    max: 100,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'last mip level' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.lastMipLevel' },
                    min: 1,
                    max: 10,
                    precision: 0
                })
            )
        ),
        jsx(Panel, { headerText: 'Grading' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'saturation' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.saturation' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'brightness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.brightness' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'contrast' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.contrast' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            )
        ),
        jsx(Panel, { headerText: 'Vignette' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'inner' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.inner' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'outer' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.outer' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'curvature' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.curvature' },
                    min: 0.01,
                    max: 10,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.intensity' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            )
        ),
        jsx(Panel, { headerText: 'Fringing' },
            jsx(LabelGroup, { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.fringing.enabled' }
                })
            ),
            jsx(LabelGroup, { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.fringing.intensity' },
                    min: 0,
                    max: 100,
                    precision: 0
                })
            )
        )
    );
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, scriptsPath, glslangPath, twgslPath, dracoPath, pcx, data }) {

    // set up and load draco module, as the glb we load is draco compressed
    pc.WasmModule.setConfig('DracoDecoderModule', {
        glueUrl: dracoPath + 'draco.wasm.js',
        wasmUrl: dracoPath + 'draco.wasm.wasm',
        fallbackUrl: dracoPath + 'draco.js'
    });

    const assets = {
        orbit: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' }),
        platform: new pc.Asset('statue', 'container', { url: assetPath + 'models/scifi-platform.glb' }),
        mosquito: new pc.Asset('mosquito', 'container', { url: assetPath + 'models/MosquitoInAmber.glb' }),
        font: new pc.Asset('font', 'font', { url: assetPath + 'fonts/arial.json' }),
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js',

        // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
        // to avoid the additional cost. This is only used for the UI which renders on top of the
        // post-processed scene, and we're typically happy with some aliasing on the UI.
        antialias: false
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
        pc.ScriptComponentSystem,
        pc.ScreenComponentSystem,
        pc.ElementComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler,
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

        // setup skydome with low intensity
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.skyboxMip = 2;
        app.scene.exposure = 0.3;

        // render in HDR mode
        app.scene.toneMapping = pc.TONEMAP_LINEAR;
        app.scene.gammaCorrection = pc.GAMMA_NONE;

        // create an instance of the platform and add it to the scene
        const platformEntity = assets.platform.resource.instantiateRenderEntity();
        platformEntity.setLocalScale(10, 10, 10);
        app.root.addChild(platformEntity);

        // get a list of emissive materials from the scene to allow their intensity to be changed
        const emissiveMaterials = [];
        const emissiveNames = new Set(['Light_Upper_Light-Upper_0', 'Emissive_Cyan__0']);
        platformEntity.findComponents("render").forEach((render) => {
            if (emissiveNames.has(render.entity.name)) {
                render.meshInstances.forEach(meshInstance => emissiveMaterials.push(meshInstance.material));
            }
        });

        // add an instance of the mosquito mesh
        const mosquitoEntity = assets.mosquito.resource.instantiateRenderEntity();
        mosquitoEntity.setLocalScale(600, 600, 600);
        mosquitoEntity.setLocalPosition(0, 20, 0);
        app.root.addChild(mosquitoEntity);

        // helper function to create a box primitive
        const createBox = (x, y, z, r, g, b) => {
            // create material of random color
            const material = new pc.StandardMaterial();
            material.diffuse = pc.Color.BLACK;
            material.emissive = new pc.Color(r, g, b);
            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: 'box',
                material: material
            });

            // set position and scale
            primitive.setLocalPosition(x, y, z);
            app.root.addChild(primitive);

            return primitive;
        };

        // create 3 emissive boxes
        const boxes = [
            createBox(100, 20, 0, 200, 0, 0),
            createBox(-50, 20, 100, 0, 80, 0),
            createBox(90, 20, -80, 80, 80, 20)
        ];

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            farClip: 500,
            fov: 80
        });

        // add orbit camera script with a mouse and a touch support
        cameraEntity.addComponent("script");
        cameraEntity.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: mosquitoEntity,
                distanceMax: 190,
                frameOnStart: false
            }
        });
        cameraEntity.script.create("orbitCameraInputMouse");
        cameraEntity.script.create("orbitCameraInputTouch");

        // position the camera in the world
        cameraEntity.setLocalPosition(0, 40, -220);
        cameraEntity.lookAt(0, 0, 100);
        app.root.addChild(cameraEntity);

        // Create a 2D screen to place UI on
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(screen);

        // add a shadow casting directional light
        const lightColor = new pc.Color(1, 0.7, 0.1);
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: lightColor,
            intensity: 80,
            range: 400,
            shadowResolution: 4096,
            shadowDistance: 400,
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.05
        });
        app.root.addChild(light);
        light.setLocalEulerAngles(80, 10, 0);

        // a helper function to add a label to the screen
        const addLabel = (name, text, x, y, layer) => {
            const label = new pc.Entity(name);
            label.addComponent("element", {
                text: text,
                color: new pc.Color(100, 50, 80),   // very bright color to affect the bloom
                anchor: new pc.Vec4(x, y, 0.5, 0.5),
                fontAsset: assets.font,
                fontSize: 28,
                pivot: new pc.Vec2(0.5, 0.1),
                type: pc.ELEMENTTYPE_TEXT,
                alignment: pc.Vec2.ZERO,
                layers: [layer.id]
            });
            screen.addChild(label);
        };

        // add a label on the world layer, which will be affected by post-processing
        const worldLayer = app.scene.layers.getLayerByName("World");
        addLabel('WorldUI', 'Text on the World layer affected by post-processing', 0.1, 0.9, worldLayer);

        // add a label on the UI layer, which will be rendered after the post-processing
        const uiLayer = app.scene.layers.getLayerById(pc.LAYERID_UI);
        addLabel('TopUI', 'Text on theUI layer after the post-processing', 0.1, 0.1, uiLayer);

        // render passes
        let scenePass;
        let composePass;
        let bloomPass;
        let colorGrabPass;

        // helper function to create a render passes for the camera
        const setupRenderPasses = () => {

            // create a multi-sampled HDR render target to render the scene into
            const format = app.graphicsDevice.getRenderableHdrFormat() || pc.PIXELFORMAT_RGBA8;
            const sceneTexture = new pc.Texture(device, {
                name: 'SceneTexture',
                width: 4,
                height: 4,
                format: format,
                mipmaps: false,
                minFilter: pc.FILTER_LINEAR,
                magFilter: pc.FILTER_LINEAR,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE
            });

            const rt = new pc.RenderTarget({
                colorBuffer: sceneTexture,
                depth: true,
                samples: 4
            });

            // grab pass allowing us to copy the render scene into a texture and use for refraction
            // the source for the copy is the texture we render the scene to
            colorGrabPass = new pc.RenderPassColorGrab(app.graphicsDevice);
            colorGrabPass.source = rt;

            // render pass that renders the opaque scene to the render target. Render target size
            // automatically matches the back-buffer size with the optional scale. Note that the scale
            // parameters allow us to render the 3d scene at lower resolution, improving performance.
            scenePass = new pc.RenderPassRenderActions(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
            scenePass.init(rt, {
                resizeSource: null,
                scaleX: 1,
                scaleY: 1
            });

            // this pass render opaquemeshes on the world layer
            let clearRenderTarget = true;
            scenePass.addLayer(cameraEntity.camera, worldLayer, false, clearRenderTarget);

            // similar pass that renders transparent meshes from the world layer to the same render target
            clearRenderTarget = false;
            const scenePassTransparent = new pc.RenderPassRenderActions(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
            scenePassTransparent.init(rt);
            scenePassTransparent.addLayer(cameraEntity.camera, worldLayer, true, clearRenderTarget);

            // create a bloom pass, which generates bloom texture based on the just rendered scene texture
            bloomPass = new pcx.RenderPassBloom(app.graphicsDevice, sceneTexture, format);

            // create a compose pass, which combines the scene texture with the bloom texture
            composePass = new pcx.RenderPassCompose(app.graphicsDevice);
            composePass.sceneTexture = sceneTexture;
            composePass.bloomTexture = bloomPass.bloomTexture;

            // compose pass renders directly to a back-buffer
            composePass.init(null);

            // final pass renders directly to the back-buffer on top of the bloomed scene, and it renders a transparent UI layer
            const afterPass = new pc.RenderPassRenderActions(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
            afterPass.init(null);
            afterPass.addLayer(cameraEntity.camera, uiLayer, true, clearRenderTarget);

            // return these prepared render passes in the order they should be executed
            return [scenePass, colorGrabPass, scenePassTransparent, bloomPass, composePass, afterPass];
        };

        // set up render passes on the camera, to use those instead of the default camera rendering
        const renderPasses = setupRenderPasses();
        cameraEntity.camera.renderPasses = renderPasses;

        data.on('*:set', (/** @type {string} */ path, value) => {
            const pathArray = path.split('.');
            if (pathArray[1] === 'scene') {
                if (pathArray[2] === 'scale') {
                    scenePass.options.scaleX = value;
                    scenePass.options.scaleY = value;
                }
                if (pathArray[2] === 'tonemapping') {
                    composePass.toneMapping = value;
                    composePass._shaderDirty = true;
                }
                if (pathArray[2] === 'background') {
                    cameraEntity.camera.clearColor = new pc.Color(lightColor.r * value, lightColor.g * value, lightColor.b * value);
                    light.light.intensity = value;
                }
                if (pathArray[2] === 'emissive') {
                    emissiveMaterials.forEach((material) => {
                        material.emissiveIntensity = value;
                        material.update();
                    });
                }
            }
            if (pathArray[1] === 'bloom') {
                if (pathArray[2] === 'intensity') {
                    composePass.bloomIntensity = pc.math.lerp(0, 0.1, value / 100);
                }
                if (pathArray[2] === 'lastMipLevel') {
                    bloomPass.lastMipLevel = value;
                }
                if (pathArray[2] === 'enabled') {
                    composePass.bloomTexture = value ? bloomPass.bloomTexture : null;
                }
            }
            if (pathArray[1] === 'grading') {
                if (pathArray[2] === 'saturation') {
                    composePass.gradingSaturation = value;
                }
                if (pathArray[2] === 'brightness') {
                    composePass.gradingBrightness = value;
                }
                if (pathArray[2] === 'contrast') {
                    composePass.gradingContrast = value;
                }
                if (pathArray[2] === 'enabled') {
                    composePass.gradingEnabled = value;
                }
            }
            if (pathArray[1] === 'vignette') {
                if (pathArray[2] === 'enabled') {
                    composePass.vignetteEnabled = value;
                }
                if (pathArray[2] === 'inner') {
                    composePass.vignetteInner = value;
                }
                if (pathArray[2] === 'outer') {
                    composePass.vignetteOuter = value;
                }
                if (pathArray[2] === 'curvature') {
                    composePass.vignetteCurvature = value;
                }
                if (pathArray[2] === 'intensity') {
                    composePass.vignetteIntensity = value;
                }
            }
            if (pathArray[1] === 'fringing') {
                if (pathArray[2] === 'enabled') {
                    composePass.fringingEnabled = value;
                }
                if (pathArray[2] === 'intensity') {
                    composePass.fringingIntensity = value;
                }
            }
        });

        data.set('data', {
            scene: {
                scale: 1.8,
                background: 6,
                emissive: 200,
                tonemapping: pc.TONEMAP_ACES
            },
            bloom: {
                enabled: true,
                intensity: 20,
                lastMipLevel: 1
            },
            grading: {
                enabled: false,
                saturation: 1,
                brightness: 1,
                contrast: 1
            },
            vignette: {
                enabled: false,
                inner: 0.5,
                outer: 1.0,
                curvature: 0.5,
                intensity: 0.3
            },
            fringing: {
                enabled: false,
                intensity: 50
            }
        });

        // update things every frame
        let angle = 0;
        app.on("update", function (/** @type {number} */dt) {
            angle += dt;

            // scale the boxes
            for (let i = 0; i < boxes.length; i++) {
                const offset = Math.PI * 2 * i / (boxes.length);
                const scale = 25 + Math.sin(angle + offset) * 10;
                boxes[i].setLocalScale(scale, scale, scale);
            }

            // rotate the mosquitoEntity
            mosquitoEntity.setLocalEulerAngles(0, angle * 30, 0);
        });
    });
    return app;
}

export class PostprocessingExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}
