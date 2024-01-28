import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Shadow Cascade Settings' },
            jsx(LabelGroup, { text: 'Filtering' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.shadowType' },
                    type: "number",
                    options: [
                        { v: pc.SHADOW_PCF1, t: 'PCF1' },
                        { v: pc.SHADOW_PCF3, t: 'PCF3' },
                        { v: pc.SHADOW_PCF5, t: 'PCF5' },
                        { v: pc.SHADOW_VSM8, t: 'VSM8' },
                        { v: pc.SHADOW_VSM16, t: 'VSM16' },
                        { v: pc.SHADOW_VSM32, t: 'VSM32' }
                    ]
                })
            ),
            jsx(LabelGroup, { text: 'Count' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.numCascades' },
                    min: 1,
                    max: 4,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'Every Frame' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.everyFrame' },
                    value: observer.get('settings.light.everyFrame')
                })
            ),
            jsx(LabelGroup, { text: 'Resolution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.shadowResolution' },
                    min: 128,
                    max: 2048,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'Distribution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.cascadeDistribution' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'VSM Blur' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.vsmBlurSize' },
                    min: 1,
                    max: 25,
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
async function example({ canvas, deviceType, data, assetPath, scriptsPath, glslangPath, twgslPath }) {

    const assets = {
        script: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' }),
        terrain: new pc.Asset('terrain', 'container', { url: assetPath + 'models/terrain.glb' }),
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

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        data.set('settings', {
            light: {
                numCascades: 4,             // number of cascades
                shadowResolution: 2048,     // shadow map resolution storing 4 cascades
                cascadeDistribution: 0.5,   // distribution of cascade distances to prefer sharpness closer to the camera
                shadowType: pc.SHADOW_PCF3, // shadow filter type
                vsmBlurSize: 11,            // shader filter blur size for VSM shadows
                everyFrame: true            // true if all cascades update every frame
            }
        });

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // Ensure canvas is resized when window changes size
        const resize = () => app.resizeCanvas();
        window.addEventListener('resize', resize);
        app.on('destroy', () => {
            window.removeEventListener('resize', resize);
        });

        // setup skydome
        app.scene.skyboxMip = 3;
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -70, 0);
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // instantiate the terrain
        /** @type {pc.Entity} */
        const terrain = assets.terrain.resource.instantiateRenderEntity();
        terrain.setLocalScale(30, 30, 30);
        app.root.addChild(terrain);

        // get the clouds so that we can animate them
        /** @type {Array<pc.Entity>} */
        const srcClouds = terrain.find((node) => {

            const isCloud = node.name.includes('Icosphere');

            if (isCloud) {
                // no shadow receiving for clouds
                node.render.receiveShadows = false;
            }

            return isCloud;
        });

        // clone some additional clouds
        /** @type {Array<pc.Entity>} */
        const clouds = [];
        srcClouds.forEach((cloud) => {
            clouds.push(cloud);

            for (let i = 0; i < 3; i++) {
                /** @type {pc.Entity} */
                const clone = cloud.clone();
                cloud.parent.addChild(clone);
                clouds.push(clone);
            }
        });

        // shuffle the array to give clouds random order
        clouds.sort(() => Math.random() - 0.5);

        // find a tree in the middle to use as a focus point
        // @ts-ignore
        const tree = terrain.findOne("name", "Arbol 2.002");

        // create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.9, 0.9, 0.9),
            farClip: 1000
        });

        // and position it in the world
        camera.setLocalPosition(300, 160, 25);

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

        // Create a directional light casting cascaded shadows
        const dirLight = new pc.Entity();
        dirLight.addComponent("light", {
            ...{
                type: "directional",
                color: pc.Color.WHITE,
                shadowBias: 0.3,
                normalOffsetBias: 0.2,
                intensity: 1.0,

                // enable shadow casting
                castShadows: true,
                shadowDistance: 1000
            },
            ...data.get('settings.light')
        });
        app.root.addChild(dirLight);
        dirLight.setLocalEulerAngles(45, 350, 20);

        // update mode of cascades
        let updateEveryFrame = true;

        // handle HUD changes - update properties on the light
        data.on('*:set', (/** @type {string} */ path, value) => {
            const pathArray = path.split('.');

            if (pathArray[2] === 'everyFrame') {
                updateEveryFrame = value;
            } else {
                // @ts-ignore
                dirLight.light[pathArray[2]] = value;
            }
        });

        const cloudSpeed = 0.2;
        let frameNumber = 0;
        let time = 0;
        app.on("update", function (/** @type {number} */dt) {

            time += dt;

            // on the first frame, when camera is updated, move it further away from the focus tree
            if (frameNumber === 0) {
                // @ts-ignore engine-tsd
                camera.script.orbitCamera.distance = 470;
            }

            if (updateEveryFrame) {

                // no per cascade rendering control
                dirLight.light.shadowUpdateOverrides = null;

            } else {

                // set up shadow update overrides, nearest cascade updates each frame, then next one every 5 and so on
                dirLight.light.shadowUpdateOverrides = [
                    pc.SHADOWUPDATE_THISFRAME,
                    (frameNumber % 5) === 0 ? pc.SHADOWUPDATE_THISFRAME : pc.SHADOWUPDATE_NONE,
                    (frameNumber % 10) === 0 ? pc.SHADOWUPDATE_THISFRAME : pc.SHADOWUPDATE_NONE,
                    (frameNumber % 15) === 0 ? pc.SHADOWUPDATE_THISFRAME : pc.SHADOWUPDATE_NONE
                ];
            }

            // move the clouds around
            clouds.forEach((cloud, index) => {
                const redialOffset = (index / clouds.length) * (6.24 / cloudSpeed);
                const radius = 9 + 4 * Math.sin(redialOffset);
                const cloudTime = time + redialOffset;
                cloud.setLocalPosition(2 + radius * Math.sin(cloudTime * cloudSpeed), 4, -5 + radius * Math.cos(cloudTime * cloudSpeed));
            });

            frameNumber++;
        });
    });
    return app;
}

export class ShadowCascadesExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}
