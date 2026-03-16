// @config DESCRIPTION Click on objects to detect world space intersection. Objects within the colored rectangles are highlighted.
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

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
    let mouseX = 0,
        mouseY = 0;

    // generate a box area with specified size of random primitives
    const size = 30;
    const halfSize = size * 0.5;
    for (let i = 0; i < 300; i++) {
        const shape = Math.random() < 0.5 ? 'cylinder' : 'sphere';
        const position = new pc.Vec3(
            Math.random() * size - halfSize,
            Math.random() * size - halfSize,
            Math.random() * size - halfSize
        );
        const scale = 1 + Math.random();
        const entity = createPrimitive(shape, position, new pc.Vec3(scale, scale, scale));
        app.root.addChild(entity);
    }

    // handle mouse move event and store current mouse position to use as a position to pick from the scene
    new pc.Mouse(document.body).on(
        'mousemove',
        (event) => {
            mouseX = event.x;
            mouseY = event.y;
        },
        this
    );

    // Create an instance of the picker class
    // Lets use quarter of the resolution to improve performance - this will miss very small objects, but it's ok in our case
    const picker = new pc.Picker(app, canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale, true);

    /**
     * Helper function to create a primitive with shape type, position, scale.
     *
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
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    app.root.addChild(camera);

    // ------ Custom render passes with bloom ------
    const cameraFrame = new pc.CameraFrame(app, camera.camera);
    cameraFrame.bloom.intensity = 0.01;
    cameraFrame.bloom.blurLevel = 4;
    cameraFrame.update();

    /**
     * Function to draw a 2D rectangle in the screen space coordinates.
     *
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
        const points = [pt0, pt1, pt1, pt2, pt2, pt3, pt3, pt0];
        const colors = [pink, pink, pink, pink, pink, pink, pink, pink];
        app.drawLines(points, colors);
    }

    /**
     * Sets material emissive color to specified color.
     *
     * @param {pc.StandardMaterial} material - The material to highlight.
     * @param {pc.Color} color - The color to highlight with.
     */
    function highlightMaterial(material, color) {
        material.emissive = color;
        material.emissiveIntensity = 30;
        material.update();
    }

    // array of highlighted materials
    /** @type {pc.StandardMaterial[]} */
    const highlights = [];

    // the layers picker renders
    const worldLayer = app.scene.layers.getLayerByName('World');
    const pickerLayers = [worldLayer];

    // marker sphere to show the picked world point
    const marker = createPrimitive('sphere', pc.Vec3.ZERO, new pc.Vec3(0.2, 0.2, 0.2));
    const markerMaterial = new pc.StandardMaterial();
    markerMaterial.emissive = new pc.Color(0, 1, 0);
    markerMaterial.emissiveIntensity = 100;
    marker.render.material = markerMaterial;
    marker.render.meshInstances[0].pick = false;
    marker.enabled = false;
    app.root.addChild(marker);

    // store pending pick request
    /** @type {{ x: number, y: number } | null} */
    let pendingPickRequest = null;

    // handle mouse click to pick world point
    const mouse = new pc.Mouse(document.body);
    mouse.on('mousedown', (event) => {
        // store the pick request to be processed after picker.prepare
        pendingPickRequest = {
            x: event.x * pickerScale,
            y: event.y * pickerScale
        };
    });

    // update each frame
    let time = 0;
    app.on('update', (/** @type {number} */ dt) => {
        time += dt * 0.1;

        // orbit the camera around
        if (!camera) {
            return;
        }

        camera.setLocalPosition(40 * Math.sin(time), 0, 40 * Math.cos(time));
        camera.lookAt(pc.Vec3.ZERO);

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

        // process all areas every frame
        const promises = [];
        for (let a = 0; a < areas.length; a++) {
            const areaPos = areas[a].pos;
            const areaSize = areas[a].size;

            // display 2D rectangle around it
            drawRectangle(areaPos.x, areaPos.y, areaSize.x, areaSize.y);

            // get list of meshInstances inside the area from the picker
            // this scans the pixels inside the render target and maps the id value stored there into meshInstances
            // Note that this is an async function returning a promise. Store it in the promises array.
            const promise = picker.getSelectionAsync(
                areaPos.x * pickerScale,
                areaPos.y * pickerScale,
                areaSize.x * pickerScale,
                areaSize.y * pickerScale
            );

            promises.push(promise);
        }

        // when all promises are resolved, we can highlight the meshes
        Promise.all(promises).then((results) => {

            // turn off previously highlighted meshes
            for (let h = 0; h < highlights.length; h++) {
                highlightMaterial(highlights[h], pc.Color.BLACK);
                // Reset emissive intensity when turning off
                highlights[h].emissiveIntensity = 0;
            }
            highlights.length = 0;

            // process the results
            for (let i = 0; i < results.length; i++) {
                const meshInstances = results[i];

                for (let s = 0; s < meshInstances.length; s++) {
                    if (meshInstances[s]) {
                        /** @type {pc.StandardMaterial} */
                        const material = meshInstances[s].material;
                        highlightMaterial(material, areas[i].color);
                        highlights.push(material);
                    }
                }
            }
        });

        // process pending pick request after picker.prepare has been called
        if (pendingPickRequest && picker) {
            const { x, y } = pendingPickRequest;
            pendingPickRequest = null;

            picker.getWorldPointAsync(x, y).then((worldPoint) => {
                if (worldPoint) {
                    marker.enabled = true;
                    marker.setPosition(worldPoint);
                } else {
                    marker.enabled = false;
                }
            });
        }

        // display the picker's buffers side by side in the bottom right corner
        // color buffer (left) and depth buffer (right), with equal margins from edges
        if (picker.colorBuffer) {
            // @ts-ignore engine-tsd
            app.drawTexture(0.55, -0.77, 0.2, 0.2, picker.colorBuffer);
        }

        if (picker.depthBuffer) {
            // @ts-ignore engine-tsd
            app.drawTexture(0.77, -0.77, 0.2, 0.2, picker.depthBuffer);
        }
    });
});

export { app };
