import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, Label, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Lightmap Filter Settings' },
            jsx(LabelGroup, { text: 'enable' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.settings.lightmapFilterEnabled' },
                    value: observer.get('data.settings.lightmapFilterEnabled')
                })
            ),
            jsx(LabelGroup, { text: 'range' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.settings.lightmapFilterRange' },
                    value: observer.get('data.settings.lightmapFilterRange'),
                    min: 1,
                    max: 20,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'smoothness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.settings.lightmapFilterSmoothness' },
                    value: observer.get('data.settings.lightmapFilterSmoothness'),
                    min: 0.1,
                    max: 2,
                    precision: 1
                })
            )
        ),
        jsx(Panel, { headerText: 'Ambient light' },
            jsx(LabelGroup, { text: 'bake' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.ambientBake' },
                    value: observer.get('data.ambient.ambientBake')
                })
            ),
            jsx(LabelGroup, { text: 'cubemap' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.cubemap' },
                    value: observer.get('data.ambient.cubemap')
                })
            ),
            jsx(LabelGroup, { text: 'hemisphere' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.hemisphere' },
                    value: observer.get('data.ambient.hemisphere')
                })
            ),
            jsx(LabelGroup, { text: 'samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.ambientBakeNumSamples' },
                    value: observer.get('data.ambient.ambientBakeNumSamples'),
                    max: 64,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'contrast' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.ambientBakeOcclusionContrast' },
                    value: observer.get('data.ambient.ambientBakeOcclusionContrast'),
                    min: -1,
                    max: 1,
                    precision: 1
                })
            ),
            jsx(LabelGroup, { text: 'brightness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.ambientBakeOcclusionBrightness' },
                    value: observer.get('data.ambient.ambientBakeOcclusionBrightness'),
                    min: -1,
                    max: 1,
                    precision: 1
                })
            )
        ),
        jsx(Panel, { headerText: 'Directional light' },
            jsx(LabelGroup, { text: 'enable' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.directional.enabled' },
                    value: observer.get('data.directional.enabled')
                })
            ),
            jsx(LabelGroup, { text: 'bake' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.directional.bake' },
                    value: observer.get('data.directional.bake')
                })
            ),
            jsx(LabelGroup, { text: 'samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.directional.bakeNumSamples' },
                    value: observer.get('data.directional.bakeNumSamples'),
                    max: 64,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'area' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.directional.bakeArea' },
                    value: observer.get('data.directional.bakeArea'),
                    max: 40,
                    precision: 0
                })
            )
        ),
        jsx(Panel, { headerText: 'Other lights' },
            jsx(LabelGroup, { text: 'enable' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.other.enabled' },
                    value: observer.get('data.other.enabled')
                })
            )
        ),
        jsx(Panel, { headerText: 'Bake stats' },
            jsx(LabelGroup, { text: 'duration' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.stats.duration' },
                    value: observer.get('data.stats.duration')
                })
            )
        )
    );
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, data, assetPath, scriptsPath, glslangPath, twgslPath }) {

    const assets = {
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        house: new pc.Asset('house', 'container', { url: assetPath + 'models/house.glb' }),
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

    // @ts-ignore
    createOptions.lightmapper = pc.Lightmapper;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.ScriptHandler,
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.CubemapHandler
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

        // setup skydome - this is the main source of ambient light
        app.scene.skyboxMip = 3;
        app.scene.skyboxIntensity = 0.6;
        app.scene.envAtlas = assets.helipad.resource;

        // if skydome cubemap is disabled using HUD, a constant ambient color is used instead
        app.scene.ambientLight = new pc.Color(0.1, 0.3, 0.4);

        // instantiate the house model, which has unwrapped texture coordinates for lightmap in UV1
        const house = assets.house.resource.instantiateRenderEntity();
        house.setLocalScale(100, 100, 100);
        app.root.addChild(house);

        // change its materials to lightmapping
        /** @type {Array<pc.RenderComponent>} */
        const renders = house.findComponents("render");
        renders.forEach((render) => {
            render.castShadows = true;
            render.castShadowsLightmap = true;
            render.lightmapped = true;
        });

        // directional light
        const lightDirectional = new pc.Entity("Directional");
        lightDirectional.addComponent("light", {
            type: "directional",

            // disable to not have shadow map updated every frame,
            // as the scene does not have dynamically lit objects
            affectDynamic: false,

            affectLightmapped: true,
            castShadows: true,
            normalOffsetBias: 0.05,
            shadowBias: 0.2,
            shadowDistance: 100,
            shadowResolution: 2048,
            shadowType: pc.SHADOW_PCF3,
            color: new pc.Color(0.7, 0.7, 0.5),
            intensity: 1.6
        });
        app.root.addChild(lightDirectional);
        lightDirectional.setLocalEulerAngles(-55, 0, -30);

        // Create an entity with a omni light component that is configured as a baked light
        const lightOmni = new pc.Entity("Omni");
        lightOmni.addComponent("light", {
            type: "omni",
            affectDynamic: false,
            affectLightmapped: true,
            bake: true,
            castShadows: true,
            normalOffsetBias: 0.05,
            shadowBias: 0.2,
            shadowDistance: 25,
            shadowResolution: 512,
            shadowType: pc.SHADOW_PCF3,
            color: pc.Color.YELLOW,
            range: 25,
            intensity: 0.9
        });
        lightOmni.setLocalPosition(-4, 10, 5);
        app.root.addChild(lightOmni);

        // Create an entity with a spot light component that is configured as a baked light
        const lightSpot = new pc.Entity("Spot");
        lightSpot.addComponent("light", {
            type: "spot",
            affectDynamic: false,
            affectLightmapped: true,
            bake: true,
            castShadows: true,
            normalOffsetBias: 0.05,
            shadowBias: 0.2,
            shadowDistance: 50,
            shadowResolution: 512,
            shadowType: pc.SHADOW_PCF3,
            color: pc.Color.RED,
            range: 10,
            intensity: 2.5
        });
        lightSpot.setLocalPosition(-5, 10, -7.5);
        app.root.addChild(lightSpot);

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            farClip: 100,
            nearClip: 1
        });
        camera.setLocalPosition(40, 20, 40);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: house,
                distanceMax: 60
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        // lightmap baking properties
        const bakeType = pc.BAKE_COLOR;
        app.scene.lightmapMode = bakeType;
        app.scene.lightmapMaxResolution = 1024;

        // multiplier for lightmap resolution
        app.scene.lightmapSizeMultiplier = 512;

        // bake when settings are changed only
        let needBake = false;

        // handle data changes from HUD to modify baking properties
        data.on('*:set', (/** @type {string} */ path, value) => {
            let bakeSettingChanged = true;
            const pathArray = path.split('.');

            // ambient light
            if (pathArray[1] === 'ambient') {
                if (pathArray[2] === 'cubemap') {
                    // enable / disable cubemap
                    app.scene.envAtlas = value ? assets.helipad.resource : null;
                } else if (pathArray[2] === 'hemisphere') {
                    // switch between smaller upper hemisphere and full sphere
                    app.scene.ambientBakeSpherePart = value ? 0.4 : 1;
                } else {
                    // all other values are set directly on the scene
                    // @ts-ignore engine-tsd
                    app.scene[pathArray[2]] = value;
                }
            } else if (pathArray[1] === 'directional') {
                // @ts-ignore engine-tsd
                lightDirectional.light[pathArray[2]] = value;
            } else if (pathArray[1] === 'settings') {
                // @ts-ignore engine-tsd
                app.scene[pathArray[2]] = value;
            } else if (pathArray[1] === 'other') {
                // @ts-ignore engine-tsd
                lightOmni.light[pathArray[2]] = value;
                // @ts-ignore engine-tsd
                lightSpot.light[pathArray[2]] = value;
            } else {
                // don't rebake if stats change
                bakeSettingChanged = false;
            }

            // trigger bake on the next frame if relevant settings were changes
            needBake ||= bakeSettingChanged;
        });

        // bake properties connected to the HUD
        data.set('data', {
            settings: {
                lightmapFilterEnabled: true,
                lightmapFilterRange: 10,
                lightmapFilterSmoothness: 0.2
            },
            ambient: {
                ambientBake: true,
                cubemap: true,
                hemisphere: true,
                ambientBakeNumSamples: 20,
                ambientBakeOcclusionContrast: -0.6,
                ambientBakeOcclusionBrightness: -0.5
            },
            directional: {
                enabled: true,
                bake: true,
                bakeNumSamples: 15,
                bakeArea: 10
            },
            other: {
                enabled: true
            },
            stats: {
                duration: ''
            }
        });

        // Set an update function on the app's update event
        app.on("update", function (dt) {

            // bake lightmaps when HUD properties change
            if (needBake) {
                needBake = false;
                app.lightmapper.bake(null, bakeType);

                // update stats with the bake duration
                data.set('data.stats.duration', app.lightmapper.stats.totalRenderTime.toFixed(1) + 'ms');
            }
        });
    });
    return app;
}

export class LightsBakedAOExample {
    static CATEGORY = 'Graphics';
    static controls = controls;
    static example = example;
}
