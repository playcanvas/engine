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
                    max: 1000,
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
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath, dracoPath, pcx, data }) {

    const assets = {
        orbit: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' }),
        car: new pc.Asset('car', 'container', { url: assetPath + 'models/lamborghini.glb' }),
        font: new pc.Asset('font', 'font', { url: assetPath + 'fonts/arial.json' }),
        biker: new pc.Asset('splat', 'container', { url: assetPath + 'splats/biker.ply' }),
        hdri: new pc.Asset('hdri', 'texture', { url: assetPath + 'hdri/wide-street.hdr' }, { mipmaps: false })
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
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler,
        // @ts-ignore
        pc.FontHandler,
        // @ts-ignore
        pc.CubemapHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);
    pcx.registerPlyParser(app);

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

        // convert hdri to skybox
        const hdriToSkybox = (source) => {

            // convert it to high resolution cubemap for the skybox
            // this is optional in case you want a really high resolution skybox
            const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
            app.scene.skybox = skybox;

            // generate env-atlas texture for the lighting
            // this would be used as low resolution skybox if high resolution is not available
            const lighting = pc.EnvLighting.generateLightingSource(source);
            const envAtlas = pc.EnvLighting.generateAtlas(lighting);
            lighting.destroy();
            app.scene.envAtlas = envAtlas;
        };

        hdriToSkybox(assets.hdri.resource);

        // setup dome based sky
        app.scene.exposure = 0.7;
        app.scene.sky.type = pc.SKYTYPE_DOME;
        app.scene.sky.node.setLocalScale(200, 200, 200);
        app.scene.sky.center = new pc.Vec3(0, 0.05, 0);

        // render in HDR mode
        app.scene.toneMapping = pc.TONEMAP_LINEAR;
        app.scene.gammaCorrection = pc.GAMMA_NONE;

        // add an instance of the car
        const carEntity = assets.car.resource.instantiateRenderEntity({
            castShadows: true
        });
        app.root.addChild(carEntity);

        const emissiveMaterials = [];
        const processEmissive = (entity, map) => {
            entity.findComponents("render").forEach((render) => {
                if (map.has(render.entity.name)) {
                    render.meshInstances.forEach((meshInstance) => {
                        meshInstance.material.emissive = map.get(render.entity.name);
                        emissiveMaterials.push(meshInstance.material);
                    });
                }
                // disable some nodes
                if (render.entity.parent?.name.includes('Plane')) {
                    render.enabled = false;
                }
            });
        };

        // get a list of emissive car materials to allow their intensity to be changed
        const carNames = new Map();
        carNames.set('Object_159', pc.Color.WHITE); // headlight
        carNames.set('Object_86', pc.Color.RED); // brake light
        carNames.set('Object_11', new pc.Color(0.1, 0.0, 0)); // wheel rims
        processEmissive(carEntity, carNames);

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            farClip: 500,
            fov: 60
        });

        const createSplatInstance = (resource, px, py, pz, scale, vertex, fragment) => {
            const splat = resource.instantiateRenderEntity({
                cameraEntity: cameraEntity,
                debugRender: false,
                fragment: fragment,
                vertex: vertex
            });
            splat.setLocalPosition(px, py, pz);
            splat.setLocalScale(scale, scale, scale);
            app.root.addChild(splat);
            return splat;
        };

        // add a splat based character
        // Note: splat renders in sRGB mode, while this needs linear, and so it's over-exposed till that is supported
        const splatEntity = createSplatInstance(assets.biker.resource, -1.5, 0.05, 0, 0.6);

        // add orbit camera script with a mouse and a touch support
        cameraEntity.addComponent("script");
        cameraEntity.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: splatEntity,
                distanceMax: 10,
                frameOnStart: false
            }
        });
        cameraEntity.script.create("orbitCameraInputMouse");
        cameraEntity.script.create("orbitCameraInputTouch");

        // position the camera in the world
        cameraEntity.setLocalPosition(2, 2, -4);
        cameraEntity.lookAt(0, 0, 1);
        app.root.addChild(cameraEntity);

        // add a shadow casting directional light
        const lightColor = new pc.Color(1, 0.7, 0.1);
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: lightColor,
            intensity: 1,
            range: 400,
            shadowResolution: 2048,
            shadowDistance: 400,
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.05
        });
        app.root.addChild(light);
        light.setLocalEulerAngles(80, 10, 0);

        // ------ Custom render passes set up ------

        // Use a render pass camera, which is a render pass that implements typical rendering of a camera.
        // Internally this sets up additional passes it needs, based on the options passed to it.
        const renderPassCamera = new pcx.RenderPassCameraFrame(app, {
            camera: cameraEntity.camera,    // camera used to render those passes
            samples: 2,                     // number of samples for multi-sampling
            sceneColorMap: true             // true if the scene color should be captured
        });

        // and set up these rendering passes to be used by the camera, instead of its default rendering
        cameraEntity.camera.renderPasses = [renderPassCamera];

        // ------

        // access compose pass to change its settings - this is the pass that combines the scene
        // with the post-processing effects
        const { composePass } = renderPassCamera;

        data.on('*:set', (/** @type {string} */ path, value) => {
            const pathArray = path.split('.');
            if (pathArray[1] === 'scene') {
                if (pathArray[2] === 'scale') {
                    renderPassCamera.renderTargetScale = value;
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
                    renderPassCamera.lastMipLevel = value;
                }
                if (pathArray[2] === 'enabled') {
                    renderPassCamera.bloomEnabled = value;
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
                background: 1.5,
                emissive: 600,
                tonemapping: pc.TONEMAP_ACES2
            },
            bloom: {
                enabled: true,
                intensity: 20,
                lastMipLevel: 3
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
    });

    return app;
}

export class CarExample {
    static CATEGORY = 'Demos';
    static HIDDEN = true;
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}
