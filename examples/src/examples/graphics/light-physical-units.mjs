import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Lights' },
            jsx(LabelGroup, { text: 'Rect (lm)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.rect.luminance' },
                    min: 0.0,
                    max: 800000.0
                })
            ),
            jsx(LabelGroup, { text: 'Point (lm)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.point.luminance' },
                    min: 0.0,
                    max: 800000.0
                })
            ),
            jsx(LabelGroup, { text: 'Spot (lm)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.spot.luminance' },
                    min: 0.0,
                    max: 200000.0
                })
            ),
            jsx(LabelGroup, { text: 'Spot angle' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.spot.aperture' },
                    min: 1.0,
                    max: 90.0
                })
            )
        ),
        jsx(Panel, { headerText: 'Camera' },
            jsx(LabelGroup, { text: 'Aperture (F/x)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.camera.aperture' },
                    min: 1.0,
                    max: 16.0
                })
            ),
            jsx(LabelGroup, { text: 'Shutter (1/x) s' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.camera.shutter' },
                    min: 1.0,
                    max: 1000.0
                })
            ),
            jsx(LabelGroup, { text: 'ISO' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.camera.sensitivity' },
                    min: 100.0,
                    max: 1000.0
                })
            )
        ),
        jsx(Panel, { headerText: 'Scene' },
            jsx(LabelGroup, { text: 'Animate' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.camera.animate' }
                })
            ),
            jsx(LabelGroup, { text: 'Physical' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.scene.physicalUnits' }
                })
            ),
            jsx(LabelGroup, { text: 'Skylight' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.scene.sky' }
                })
            ),
            jsx(LabelGroup, { text: 'Sky (lm/m2)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.sky.luminance' },
                    min: 0.0,
                    max: 100000.0
                })
            ),
            jsx(LabelGroup, { text: 'Sun (lm/m2)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.sun.luminance' },
                    min: 0.0,
                    max: 100000.0
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
        orbitCamera: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' }),
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        lights: new pc.Asset('lights', 'container', { url: assetPath + 'models/Lights.glb' }),
        sheen: new pc.Asset('sheen', 'container', { url: assetPath + 'models/SheenChair.glb' }),
        color: new pc.Asset('color', 'texture', { url: assetPath + 'textures/seaside-rocks01-color.jpg' }),
        normal: new pc.Asset('normal', 'texture', { url: assetPath + 'textures/seaside-rocks01-normal.jpg' }),
        gloss: new pc.Asset('gloss', 'texture', { url: assetPath + 'textures/seaside-rocks01-gloss.jpg' }),
        luts: new pc.Asset('luts', 'json', { url: assetPath + 'json/area-light-luts.json' })
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
        pc.ScriptHandler,
        // @ts-ignore
        pc.JsonHandler
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

        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;
        app.scene.ambientLight.set(1, 0, 0);
        app.scene.ambientLuminance = 20000;

        // enable area lights which are disabled by default for clustered lighting
        app.scene.lighting.areaLightsEnabled = true;

        // set the loaded area light LUT data
        const luts = assets.luts.resource;
        app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

        const sheen1 = assets.sheen.resource.instantiateRenderEntity({
            castShadows: true
        });
        sheen1.setLocalScale(new pc.Vec3(3, 3, 3));
        sheen1.setLocalPosition(7, -1.0, 0);
        app.root.addChild(sheen1);

        const sheen2 = assets.sheen.resource.instantiateRenderEntity({
            castShadows: true
        });
        sheen2.setLocalScale(new pc.Vec3(3, 3, 3));
        sheen2.setLocalPosition(4, -1.0, 0);
        assets.sheen.resource.applyMaterialVariant(sheen2, "Peacock Velvet");
        app.root.addChild(sheen2);

        const lights = assets.lights.resource.instantiateRenderEntity({
            castShadows: true
        });
        // enable all lights from the glb
        /** @type {Array<pc.LightComponent>} */
        const lightComponents = lights.findComponents("light");
        lightComponents.forEach((component) => {
            component.enabled = true;
        });
        lights.setLocalPosition(10, 0, 0);
        app.root.addChild(lights);

        const material = new pc.StandardMaterial();
        material.diffuseMap = assets.color.resource;
        material.normalMap = assets.normal.resource;
        material.gloss = 0.8;
        material.glossMap = assets.gloss.resource;
        material.metalness = 0.7;
        material.useMetalness = true;

        material.diffuseMapTiling.set(17, 17);
        material.normalMapTiling.set(17, 17);
        material.glossMapTiling.set(17, 17);
        material.update();

        const plane = new pc.Entity();
        plane.addComponent('render', {
            type: 'plane',
            material: material
        });
        plane.setLocalScale(new pc.Vec3(100, 0, 100));
        plane.setLocalPosition(0, -1.0, 0);
        app.root.addChild(plane);


        data.set('script', {
            sun: {
                luminance: 100000
            },
            sky: {
                luminance: 20000
            },
            spot: {
                luminance: 200000,
                aperture: 45
            },
            point: {
                luminance: 100000
            },
            rect: {
                luminance: 200000
            },
            camera: {
                aperture: 16.0,
                shutter: 1000,
                sensitivity: 1000,
                animate: false
            },
            scene: {
                physicalUnits: true,
                sky: true
            }
        });

        app.scene.physicalUnits = data.get('script.scene.physicalUnits');
        app.scene.envAtlas = assets.helipad.resource;

        app.scene.skyboxLuminance = data.get('script.sky.luminance');

        const directionalLight = new pc.Entity();
        directionalLight.addComponent("light", {
            type: "directional",
            color: pc.Color.WHITE,
            castShadows: true,
            luminance: data.get('script.sun.luminance'),
            shadowBias: 0.2,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        directionalLight.setEulerAngles(45, 35, 0);
        app.root.addChild(directionalLight);

        const omniLight = new pc.Entity();
        omniLight.addComponent("light", {
            type: "omni",
            color: pc.Color.WHITE,
            castShadows: false,
            luminance: data.get('script.point.luminance'),
            shadowBias: 0.2,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        omniLight.setLocalPosition(0, 5, 0);
        app.root.addChild(omniLight);

        const spotLight = new pc.Entity();
        spotLight.addComponent("light", {
            type: "spot",
            color: pc.Color.WHITE,
            castShadows: false,
            luminance: data.get('script.spot.luminance'),
            shadowBias: 0.2,
            normalOffsetBias: 0.05,
            shadowResolution: 2048,
            outerConeAngle: data.get('script.spot.aperture'),
            innerConeAngle: 0
        });
        spotLight.setEulerAngles(0, 0, 0);
        spotLight.setLocalPosition(10, 5, 5);
        app.root.addChild(spotLight);

        const areaLight = new pc.Entity();
        areaLight.addComponent("light", {
            type: "spot",
            shape: pc.LIGHTSHAPE_RECT,
            color: pc.Color.YELLOW,
            range: 9999,
            luminance: data.get('script.rect.luminance'),
            falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
            innerConeAngle: 80,
            outerConeAngle: 85,
            normalOffsetBias: 0.1
        });
        areaLight.setLocalScale(4, 1, 5);
        areaLight.setEulerAngles(70, 180, 0);
        areaLight.setLocalPosition(5, 3, -5);

        // emissive material that is the light source color
        const brightMaterial = new pc.StandardMaterial();
        brightMaterial.emissive = pc.Color.YELLOW;
        brightMaterial.emissiveIntensity = areaLight.light.luminance;
        brightMaterial.useLighting = false;
        brightMaterial.cull = pc.CULLFACE_NONE;
        brightMaterial.update();

        const brightShape = new pc.Entity();
        // primitive shape that matches light source shape
        brightShape.addComponent("render", {
            type: "plane",
            material: brightMaterial,
            castShadows: false
        });
        areaLight.addChild(brightShape);
        app.root.addChild(areaLight);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            aperture: data.get('script.camera.aperture'),
            shutter: 1 / data.get('script.camera.shutter'),
            sensitivity: data.get('script.camera.sensitivity')
        });
        camera.setLocalPosition(0, 5, 11);

        camera.camera.requestSceneColorMap(true);
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: sheen1,
                distanceMin: 1,
                distanceMax: 400,
                frameOnStart: false
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        data.on('*:set', (/** @type {string} */ path, value) => {
            if (path === 'script.sun.luminance') {
                directionalLight.light.luminance = value;
            } else if (path === 'script.sky.luminance') {
                app.scene.skyboxLuminance = value;
            } else if (path === 'script.spot.luminance') {
                spotLight.light.luminance = value;
            } else if (path === 'script.spot.aperture') {
                spotLight.light.outerConeAngle = value;
            } else if (path === 'script.point.luminance') {
                omniLight.light.luminance = value;
            } else if (path === 'script.rect.luminance') {
                areaLight.light.luminance = value;
                brightMaterial.emissiveIntensity = value;
                brightMaterial.update();
            } else if (path === 'script.camera.aperture') {
                camera.camera.aperture = value;
            } else if (path === 'script.camera.shutter') {
                camera.camera.shutter = 1 / value;
            } else if (path === 'script.camera.sensitivity') {
                camera.camera.sensitivity = value;
            } else if (path === 'script.scene.physicalUnits') {
                app.scene.physicalUnits = value;
            } else if (path === 'script.scene.sky') {
                if (value) {
                    app.scene.setSkybox(assets.helipad.resources);
                } else {
                    app.scene.setSkybox(null);
                }
            }
        });

        let resizeControlPanel = true;
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            // resize control panel to fit the content better
            if (resizeControlPanel) {
                const panel = window.top.document.getElementById('controlPanel');
                if (panel) {
                    panel.style.width = '360px';
                    resizeControlPanel = false;
                }
            }

            if (data.get('script.camera.animate')) {
                data.set('script.camera.aperture', 3 + (1 + Math.sin(time)) * 5.0);
            }
        });
    });
    return app;
}

export class LightPhysicalUnitsExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}
