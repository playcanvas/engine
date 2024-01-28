import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, BooleanInput, SelectInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Settings' },
            jsx(LabelGroup, { text: 'Opacity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.opacity' },
                    min: 0.0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(LabelGroup, { text: 'Dither Color' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.opacityDither' },
                    type: "string",
                    options: [
                        { v: pc.DITHER_NONE, t: 'None' },
                        { v: pc.DITHER_BAYER8, t: 'Bayer8' },
                        { v: pc.DITHER_BLUENOISE, t: 'BlueNoise' }
                    ]
                })
            ),
            jsx(LabelGroup, { text: 'Dither Shadow' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.opacityShadowDither' },
                    type: "string",
                    options: [
                        { v: pc.DITHER_NONE, t: 'None' },
                        { v: pc.DITHER_BAYER8, t: 'Bayer8' },
                        { v: pc.DITHER_BLUENOISE, t: 'BlueNoise' }
                    ]
                })
            )
        )
    );
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath, scriptsPath, data }) {

    const assets = {
        envAtlas: new pc.Asset('env-atlas', 'texture', { url: assetPath + 'cubemaps/table-mountain-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        table: new pc.Asset('table', 'container', { url: assetPath + 'models/glass-table.glb' }),
        'script': new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' })
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
    createOptions.keyboard = new pc.Keyboard(document.body);

    // render at full native resolution
    device.maxPixelRatio = window.devicePixelRatio;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        pc.TextureHandler,
        pc.ScriptHandler,
        pc.ContainerHandler
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
        app.scene.envAtlas = assets.envAtlas.resource;
        app.scene.skyboxMip = 2;
        app.scene.exposure = 1;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        /**
         * helper function to create a primitive with shape type, position, scale, color and layer
         * @param {string} primitiveType - The primitive type.
         * @param {number | pc.Vec3} position - The position.
         * @param {number | pc.Vec3} scale - The scale.
         * @param {pc.Color} color - The color.
         * @returns {pc.Material} The returned entity.
         */
        function createPrimitive(primitiveType, position, scale, color) {
            // create material of specified color
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            material.update();

            // create primitive
            const primitive = new pc.Entity(primitiveType);
            primitive.addComponent('render', {
                type: primitiveType,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return material;
        }

        // create a ground plane
        createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(30, 1, 30), new pc.Color(0.5, 0.5, 0.5));

        // create an instance of the table
        const tableEntity = assets.table.resource.instantiateRenderEntity();
        tableEntity.setLocalScale(3, 3, 3);
        app.root.addChild(tableEntity);

        // get all materials that have blending enabled
        const materials = [];
        tableEntity.findComponents("render").forEach((render) => {
            render.meshInstances.forEach((meshInstance) => {
                if (meshInstance.material.blendType !== pc.BLEND_NONE) {
                    materials.push(meshInstance.material);
                }
            });
        });

        // Create the camera
        const camera = new pc.Entity("Camera");
        camera.addComponent("camera", {
            fov: 70
        });
        camera.translate(-14, 12, 12);
        camera.lookAt(1, 4, 0);
        app.root.addChild(camera);

        // enable the camera to render the scene's color map, as the table material needs it
        camera.camera.requestSceneColorMap(true);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: tableEntity,
                distanceMax: 30,
                frameOnStart: false
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");

        // Create an Entity with a directional light, casting soft VSM shadow
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: pc.Color.WHITE,
            range: 200,
            castShadows: true,
            shadowResolution: 2048,
            shadowType: pc.SHADOW_VSM16,
            vsmBlurSize: 20,
            shadowBias: 0.1,
            normalOffsetBias: 0.1
        });
        light.setLocalEulerAngles(75, 120, 20);
        app.root.addChild(light);

        // handle UI changes
        data.on('*:set', (/** @type {string} */ path, value) => {
            const propertyName = path.split('.')[1];
            materials.forEach((material) => {

                // apply the value to the material
                material[propertyName] = value;

                // turn on / off blending depending on the dithering of the color
                if (propertyName === 'opacityDither') {
                    material.blendType = value === pc.DITHER_NONE ? pc.BLEND_NORMAL : pc.BLEND_NONE;
                }
                material.update();
            });
        });

        // initial values
        data.set('data', {
            opacity: 0.5,
            opacityDither: pc.DITHER_BAYER8,
            opacityShadowDither: pc.DITHER_BAYER8
        });
    });
    return app;
}

export class DitheredTransparencyExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static controls = controls;
    static example = example;
}
