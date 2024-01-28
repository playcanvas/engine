import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, VectorInput, LabelGroup, Panel, SliderInput, SelectInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Sky' },
            jsx(LabelGroup, { text: 'Preset' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.preset' },
                    type: "string",
                    options: [
                        { v: 'Street Dome', t: 'Street Dome' },
                        { v: 'Street Infinite', t: 'Street Infinite' },
                        { v: 'Room', t: 'Room' }
                    ]
                })
            ),
            jsx(LabelGroup, { text: 'Type' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.type' },
                    type: "string",
                    options: [
                        { v: pc.SKYTYPE_INFINITE, t: 'Infinite' },
                        { v: pc.SKYTYPE_BOX, t: 'Box' },
                        { v: pc.SKYTYPE_DOME, t: 'Dome' }
                    ]
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
            jsx(LabelGroup, { text: 'Rotation' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.rotation' },
                    min: 0,
                    max: 360,
                    precision: 0
                })
            ),
            jsx(LabelGroup, { text: 'Scale' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.scale' },
                    value: [1, 1, 1],
                    precision: 1
                })
            ),
            jsx(LabelGroup, { text: 'Position' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.position' },
                    value: [0, 0, 0],
                    precision: 1
                })
            ),
            jsx(LabelGroup, { text: 'Tripod Y' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skybox.tripodY' },
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
        hdri_street: new pc.Asset('hdri', 'texture', { url: assetPath + 'hdri/wide-street.hdr' }, { mipmaps: false }),
        hdri_room: new pc.Asset('hdri', 'texture', { url: assetPath + 'hdri/empty-room.hdr' }, { mipmaps: false })
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
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        pc.TextureHandler,
        pc.ContainerHandler,
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

        app.scene.toneMapping = pc.TONEMAP_ACES;

        // add an instance of the statue
        const statueEntity = assets.statue.resource.instantiateRenderEntity();
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
                distanceMax: 500,
                frameOnStart: false
            }
        });
        cameraEntity.script.create("orbitCameraInputMouse");
        cameraEntity.script.create("orbitCameraInputTouch");

        // position the camera in the world
        cameraEntity.setLocalPosition(-4, 5, 22);
        cameraEntity.lookAt(0, 0, 1);
        app.root.addChild(cameraEntity);

        // skydome presets
        const presetStreetDome = {
            skybox: {
                preset: 'Street Dome',
                type: pc.SKYTYPE_DOME,
                scale: [200, 200, 200],
                position: [0, 0, 0],
                tripodY: 0.05,
                exposure: 0.7,
                rotation: 0
            }
        };

        const presetStreetInfinite = {
            skybox: {
                preset: 'Street Infinite',
                type: pc.SKYTYPE_INFINITE,
                scale: [1, 1, 1],
                position: [0, 0, 0],
                tripodY: 0,
                exposure: 0.7,
                rotation: 0
            }
        };

        const presetRoom = {
            skybox: {
                preset: 'Room',
                type: pc.SKYTYPE_BOX,
                scale: [44, 24, 28],
                position: [0, 0, 0],
                tripodY: 0.6,
                exposure: 0.7,
                rotation: 50
            }
        };

        // apply hdri texture
        const applyHdri = (source) => {

            // convert it to high resolution cubemap for the skybox
            // this is optional in case you want a really high resolution skybox
            const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
            app.scene.skybox = skybox;

            // generate env-atlas texture for the lighting
            // this would also be used as low resolution skybox if high resolution is not available
            const lighting = pc.EnvLighting.generateLightingSource(source);
            const envAtlas = pc.EnvLighting.generateAtlas(lighting);
            lighting.destroy();
            app.scene.envAtlas = envAtlas;
        };

        // when UI value changes, update skybox data
        data.on('*:set', (/** @type {string} */ path, value) => {

            const pathArray = path.split('.');

            if (pathArray[2] === 'preset' && pathArray.length === 3) {

                // apply preset
                if (data.get('data.skybox.preset') === value) {

                    // apply preset data
                    data.set('data', value === 'Room' ? presetRoom : (
                        value === 'Street Dome' ? presetStreetDome : presetStreetInfinite
                    ));

                    // update hdri texture
                    applyHdri(value === 'Room' ? assets.hdri_room.resource : assets.hdri_street.resource);
                }

            } else {

                // apply individual settings
                app.scene.sky.type = data.get('data.skybox.type');
                app.scene.sky.node.setLocalScale(new pc.Vec3(data.get('data.skybox.scale') ?? [1, 1, 1]));
                app.scene.sky.node.setLocalPosition(new pc.Vec3(data.get('data.skybox.position') ?? [0, 0, 0]));
                app.scene.sky.center = new pc.Vec3(0, data.get('data.skybox.tripodY') ?? 0, 0);
                app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, data.get('data.skybox.rotation'), 0);
                app.scene.exposure = data.get('data.skybox.exposure');
            }
        });

        // apply initial preset
        data.set('data.skybox.preset', 'Street Dome');
    });

    return app;
}

export class SkyExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}
