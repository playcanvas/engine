import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(Panel, { headerText: 'Settings' },
            jsx(LabelGroup, { text: 'Alpha' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.alpha' },
                    min: 0.0,
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
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath, scriptsPath, data }) {

    const assets = {
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        checkerboard: new pc.Asset('checkerboard', 'texture', { url: assetPath + 'textures/checkboard.png' }),
        alpha: new pc.Asset("alpha", "texture", { url: assetPath + "textures/pc-gray.png" }),
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

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        pc.TextureHandler,
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

        /**
         * helper function to create a primitive with shape type, position, scale, color and layer
         * @param {string} primitiveType - The primitive type.
         * @param {number | pc.Vec3} position - The position.
         * @param {number | pc.Vec3} scale - The scale.
         * @param {pc.Color} color - The color.
         * @param {pc.Texture|null} alphaTexture - The alpha texture.
         * @returns {pc.Entity} The returned entity.
         */
        function createPrimitive(primitiveType, position, scale, color, alphaTexture = null) {
            // create material of specified color
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            if (alphaTexture) {
                material.opacityMap = alphaTexture;
                material.opacityMapChannel = "g";
                material.opacity = 0.2;
                material.opacityTint = true;    // enable opacity slider value
                material.opacityDither = true;  // enable dithering on the opacity. Note that we do not enable alpha blending.
            }
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

            return primitive;
        }

        // create ground plane and 3 primitives
        const plane = createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(30, 30, 30), new pc.Color(3, 4, 2));
        /** @type {pc.StandardMaterial} */
        const planeMaterial = plane.render.meshInstances[0].material;

        // make the texture tiles and use anisotropic filtering to prevent blurring
        planeMaterial.diffuseMap = assets.checkerboard.resource;
        planeMaterial.diffuseTint = true;
        planeMaterial.diffuseMapTiling.set(10, 10);
        planeMaterial.anisotropy = 16;

        const primitives = [
            createPrimitive("sphere", new pc.Vec3(-6, 3, 4), new pc.Vec3(6, 6, 6), pc.Color.RED, assets.alpha.resource),
            createPrimitive("cone", new pc.Vec3(-4, 3, -6), new pc.Vec3(6, 6, 6), pc.Color.CYAN, assets.alpha.resource),
            createPrimitive("box", new pc.Vec3(7, 5, 0), new pc.Vec3(10, 10, 10), pc.Color.YELLOW, assets.alpha.resource)
        ];

        // Create the camera
        const camera = new pc.Entity("Camera");
        camera.addComponent("camera", {
            fov: 70
        });
        camera.translate(0, 9, 15);
        camera.lookAt(1, 4, 0);
        app.root.addChild(camera);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: plane,
                distanceMax: 20,
                frameOnStart: false
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");

        // Create an Entity with a omni light component and add it to world layer (and so used by both cameras)
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: pc.Color.WHITE,
            range: 200,
            castShadows: true,
            shadowBias: 0.3,
            normalOffsetBias: 0.2,
        });
        light.setLocalEulerAngles(65, 150, 20);
        app.root.addChild(light);

        // setup skydome, use top mipmap level of cubemap (full resolution)
        app.scene.skyboxMip = 0;
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // handle UI changes
        data.on('*:set', (/** @type {string} */ path, value) => {
            primitives.forEach((primitive) => {
                const material = primitive.render.meshInstances[0].material;
                material.opacity = value;
                material.update();
            });
        });

        // initial value
        data.set('data.alpha', 0.6);

        // update things each frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;
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
