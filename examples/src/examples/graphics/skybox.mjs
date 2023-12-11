import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SliderInput, SelectInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Skybox' },
            jsx(LabelGroup, { text: 'Level' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.level' },
                    min: 0,
                    max: 5,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'Exposure' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.exposure' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'Projected' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.projected' }
                })
            ),
            jsx(LabelGroup, { text: 'tripod X' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.tripodX' },
                    min: -50,
                    max: 50,
                    precision: 1
                })
            ),
            jsx(LabelGroup, { text: 'tripod Y' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.tripodY' },
                    min: 0,
                    max: 0.2,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'tripod Z' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.tripodZ' },
                    min: -50,
                    max: 50,
                    precision: 1
                })
            ),
            jsx(LabelGroup, { text: 'Radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.radius' },
                    min: 1,
                    max: 200,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'Dome Offset' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.offset' },
                    min: 0,
                    max: 1,
                    precision: 2
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
        statue: new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' }),
        hdri: new pc.Asset('hdri', 'texture', { url: assetPath + 'hdri/wide-street.hdr' }, { mipmaps: false })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js',
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

        // add an instance of the statue
        const statueEntity = assets.statue.resource.instantiateRenderEntity({
        });
        app.root.addChild(statueEntity);

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            farClip: 500,
            fov: 60
        });

        // add orbit camera script with a mouse and a touch support
        cameraEntity.addComponent("script");
        cameraEntity.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: statueEntity,
                distanceMax: 40,
                frameOnStart: false
            }
        });
        cameraEntity.script.create("orbitCameraInputMouse");
        cameraEntity.script.create("orbitCameraInputTouch");

        // position the camera in the world
        cameraEntity.setLocalPosition(-4, 5, 22);
        cameraEntity.lookAt(0, 0, 1);
        app.root.addChild(cameraEntity);

        // when UI value changes, update skybox data
        data.on('*:set', (/** @type {string} */ path, value) => {

            app.scene.skyboxMip = data.get('data.skybox.level');
            app.scene.exposure = data.get('data.skybox.exposure');

            app.scene.skyboxProjectionEnabled = data.get('data.skybox.projected');

            if (app.scene.skyboxProjectionEnabled) {
                app.scene.skyboxProjectionCenter = new pc.Vec3(
                    data.get('data.skybox.tripodX'),
                    data.get('data.skybox.tripodY'),
                    data.get('data.skybox.tripodZ')
                );

                app.scene.skyboxProjectionDomeOffset = data.get('data.skybox.offset');
                app.scene.skyboxProjectionRadius = data.get('data.skybox.radius');
            }
        });

        // UI initial values
        data.set('data', {
            skybox: {
                level: 0,
                tripodX: 0,
                tripodY: 0.07,
                tripodZ: 0,
                radius: 100,
                offset: 0.75,
                exposure: 0.7,
                projected: true
            }
        });
    });

    return app;
}

export class SkyboxExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}
