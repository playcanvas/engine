import * as pc from 'playcanvas';

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath, scriptsPath }) {

    const assets = {
        bloom: new pc.Asset('bloom', 'script', { url: scriptsPath + 'posteffects/posteffect-bloom.js' }),
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
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.ScriptHandler,
        // @ts-ignore
        pc.TextureHandler
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
        app.scene.skyboxMip = 2;
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.skyboxIntensity = 0.1;

        // use a quarter resolution for picker render target (faster but less precise - can miss small objects)
        const pickerScale = 0.25;
        let mouseX = 0, mouseY = 0;

        // generate a box area with specified size of random primitives
        const size = 30;
        const halfSize = size * 0.5;
        for (let i = 0; i < 300; i++) {
            const shape = Math.random() < 0.5 ? "cylinder" : "sphere";
            const position = new pc.Vec3(Math.random() * size - halfSize, Math.random() * size - halfSize, Math.random() * size - halfSize);
            const scale = 1 + Math.random();
            const entity = createPrimitive(shape, position, new pc.Vec3(scale, scale, scale));
            app.root.addChild(entity);
        }

        // handle mouse move event and store current mouse position to use as a position to pick from the scene
        new pc.Mouse(document.body).on(pc.EVENT_MOUSEMOVE, function (event) {
            mouseX = event.x;
            mouseY = event.y;
        }, this);

        // Create an instance of the picker class
        // Lets use quarter of the resolution to improve performance - this will miss very small objects, but it's ok in our case
        const picker = new pc.Picker(app, canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);

        /**
         * helper function to create a primitive with shape type, position, scale
         * @param {string} primitiveType - The primitive type.
         * @param {pc.Vec3} position - The position.
         * @param {pc.Vec3} scale - The scale.
         * @returns {pc.Entity} The returned entity.
         */
        function createPrimitive(primitiveType, position, scale) {
            // create material of random color
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
            material.gloss = 0.6;
            material.metalness = 0.4;
            material.useMetalness = true;
            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material
            });

            // set position and scale
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);

            return primitive;
        }

        // Create main camera
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });

        // add bloom postprocessing (this is ignored by the picker)
        camera.addComponent("script");
        camera.script.create("bloom", {
            attributes: {
                bloomIntensity: 1,
                bloomThreshold: 0.7,
                blurAmount: 4
            }
        });
        app.root.addChild(camera);

        /**
         * function to draw a 2D rectangle in the screen space coordinates
         * @param {number} x - The x coordinate.
         * @param {number} y - The y coordinate.
         * @param {number} w - The width.
         * @param {number} h - The height.
         */
        function drawRectangle(x, y, w, h) {

            const pink = new pc.Color(1, 0.02, 0.58);

            // transform 4 2D screen points into world space
            const pt0 = camera.camera.screenToWorld(x, y, 1);
            const pt1 = camera.camera.screenToWorld(x + w, y, 1);
            const pt2 = camera.camera.screenToWorld(x + w, y + h, 1);
            const pt3 = camera.camera.screenToWorld(x, y + h, 1);

            // and connect them using white lines
            const points = [pt0, pt1,  pt1, pt2,  pt2, pt3,  pt3, pt0];
            const colors = [pink, pink, pink, pink, pink, pink, pink, pink];
            app.drawLines(points, colors);
        }

        /**
         * sets material emissive color to specified color
         * @param {pc.StandardMaterial} material 
         * @param {pc.Color} color 
         */
        function highlightMaterial(material, color) {
            material.emissive = color;
            material.update();
        }

        // array of highlighted materials
        /** @type {pc.StandardMaterial[]} */
        const highlights = [];

        // the layers picker renders
        const worldLayer = app.scene.layers.getLayerByName("World");
        const pickerLayers = [worldLayer];

        // update each frame
        let time = 0;
        app.on("update", function (/** @type {number} */ dt) {

            time += dt * 0.1;

            // orbit the camera around
            if (!camera) {
                return;
            }

            camera.setLocalPosition(40 * Math.sin(time), 0, 40 * Math.cos(time));
            camera.lookAt(pc.Vec3.ZERO);

            // turn all previously highlighted meshes to black at the start of the frame
            for (let h = 0; h < highlights.length; h++) {
                highlightMaterial(highlights[h], pc.Color.BLACK);
            }
            highlights.length = 0;

            // Make sure the picker is the right size, and prepare it, which renders meshes into its render target
            if (picker) {
                picker.resize(canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);
                picker.prepare(camera.camera, app.scene, pickerLayers);
            }

            // areas we want to sample - two larger rectangles, one small square, and one pixel at a mouse position
            // assign them different highlight colors as well
            const areas = [
                {
                    pos: new pc.Vec2(canvas.clientWidth * 0.3, canvas.clientHeight * 0.3),
                    size: new pc.Vec2(100, 200),
                    color: pc.Color.YELLOW
                },
                {
                    pos: new pc.Vec2(canvas.clientWidth * 0.6, canvas.clientHeight * 0.7),
                    size: new pc.Vec2(200, 20),
                    color: pc.Color.CYAN
                },
                {
                    pos: new pc.Vec2(canvas.clientWidth * 0.8, canvas.clientHeight * 0.3),
                    size: new pc.Vec2(5, 5),
                    color: pc.Color.MAGENTA
                },
                {
                    // area based on mouse position
                    pos: new pc.Vec2(mouseX, mouseY),
                    size: new pc.Vec2(1, 1),
                    color: pc.Color.RED
                }
            ];

            // process all areas
            for (let a = 0; a < areas.length; a++) {
                const areaPos = areas[a].pos;
                const areaSize = areas[a].size;
                const color = areas[a].color;

                // display 2D rectangle around it
                drawRectangle(areaPos.x, areaPos.y, areaSize.x, areaSize.y);

                // get list of meshInstances inside the area from the picker
                // this scans the pixels inside the render target and maps the id value stored there into meshInstances
                const selection = picker.getSelection(areaPos.x * pickerScale, areaPos.y * pickerScale, areaSize.x * pickerScale, areaSize.y * pickerScale);

                // process all meshInstances it found - highlight them to appropriate color for the area
                for (let s = 0; s < selection.length; s++) {
                    if (selection[s]) {
                        /** @type {pc.StandardMaterial} */
                        const material = selection[s].material;
                        highlightMaterial(material, color);
                        highlights.push(material);
                    }
                }
            }
        });
    });
    return app;
}

export class AreaPickerExample {
    static CATEGORY = 'Graphics';
    static example = example;
    static WEBGPU_ENABLED = false; // device.updateBegin() is not a function
}
