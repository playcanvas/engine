import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

data.set('settings', {
    material: {
        gloss: 0.8,
        metalness: 0.7
    }
});

const assets = {
    bloom: new pc.Asset('bloom', 'script', { url: rootPath + '/static/scripts/posteffects/posteffect-bloom.js' }),
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    color: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' }),
    normal: new pc.Asset('normal', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-normal.jpg' }),
    gloss: new pc.Asset('gloss', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
    luts: new pc.Asset('luts', 'json', { url: rootPath + '/static/assets/json/area-light-luts.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

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
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.JsonHandler];

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

    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // enabled clustered lighting. This is a temporary API and will change in the future
    app.scene.clusteredLightingEnabled = true;

    // adjust default clustered lighting parameters to handle many lights
    const lighting = app.scene.lighting;

    // 1) subdivide space with lights into this many cells
    lighting.cells = new pc.Vec3(30, 2, 30);

    // 2) and allow this many lights per cell
    lighting.maxLightsPerCell = 20;

    lighting.areaLightsEnabled = true;
    lighting.shadowsEnabled = false;

    // pure black material - used on back side of light objects
    const blackMaterial = new pc.StandardMaterial();
    blackMaterial.diffuse = new pc.Color(0, 0, 0);
    blackMaterial.useLighting = false;
    blackMaterial.update();

    // ground material
    const groundMaterial = new pc.StandardMaterial();
    groundMaterial.diffuse = pc.Color.GRAY;
    groundMaterial.gloss = 0.8;
    groundMaterial.metalness = 0.7;
    groundMaterial.useMetalness = true;

    /**
     * Helper function to create a primitive with shape type, position, scale and color.
     *
     * @param {string} primitiveType - The type of the primitive.
     * @param {pc.Vec3} position - The position.
     * @param {pc.Vec3} scale - The scale.
     * @param {*} assetManifest - The asset manifest.
     * @returns {pc.Entity} The new primitive entity.
     */
    function createPrimitive(primitiveType, position, scale, assetManifest) {
        if (assetManifest) {
            groundMaterial.diffuseMap = assetManifest.color.resource;
            groundMaterial.normalMap = assetManifest.normal.resource;
            groundMaterial.glossMap = assetManifest.gloss.resource;

            groundMaterial.diffuseMapTiling.set(17, 17);
            groundMaterial.normalMapTiling.set(17, 17);
            groundMaterial.glossMapTiling.set(17, 17);
        }

        groundMaterial.update();

        // create primitive
        const primitive = new pc.Entity();
        primitive.addComponent('render', {
            type: primitiveType,
            material: groundMaterial
        });

        // set position and scale and add it to scene
        primitive.setLocalPosition(position);
        primitive.setLocalScale(scale);
        app.root.addChild(primitive);

        return primitive;
    }

    /**
     * Helper function to create area light including its visual representation in the world.
     *
     * @param {string} type - The light component's type.
     * @param {number} shape - The light component's shape.
     * @param {pc.Vec3} position - The position.
     * @param {pc.Vec3} scale - The scale.
     * @param {pc.Color} color - The color.
     * @param {number} intensity - The light component's intensity.
     * @param {number} range - The light component's range.
     * @returns {pc.Entity} The returned entity.
     */
    function createAreaLight(type, shape, position, scale, color, intensity, range) {
        const light = new pc.Entity();
        light.addComponent('light', {
            type: type,
            shape: shape,
            color: color,
            intensity: intensity,
            falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
            range: range,
            innerConeAngle: 88,
            outerConeAngle: 89
        });

        light.setLocalScale(scale);
        light.setLocalPosition(position);
        if (type === 'spot') {
            light.rotate(-90, 0, 0);
        }
        app.root.addChild(light);

        // emissive material that is the light source color
        const brightMaterial = new pc.StandardMaterial();
        brightMaterial.emissive = new pc.Color(color.r * 0.8, color.g * 0.8, color.b * 0.8);
        brightMaterial.useLighting = false;
        brightMaterial.update();

        // primitive shape that matches light source shape
        const lightPrimitive =
            shape === pc.LIGHTSHAPE_SPHERE ? 'sphere' : shape === pc.LIGHTSHAPE_DISK ? 'cylinder' : 'box';

        // primitive scale - flatten it to disk / rectangle
        const primitiveScale = new pc.Vec3(1, shape !== pc.LIGHTSHAPE_SPHERE ? 0.001 : 1, 1);

        // bright primitive representing the area light source
        const brightShape = new pc.Entity();
        brightShape.addComponent('render', {
            type: lightPrimitive,
            material: brightMaterial
        });
        brightShape.setLocalScale(primitiveScale);
        light.addChild(brightShape);

        // black primitive representing the back of the light source which is not emitting light
        if (type === 'spot') {
            const blackShape = new pc.Entity();
            blackShape.addComponent('render', {
                type: lightPrimitive,
                material: blackMaterial
            });
            blackShape.setLocalPosition(0, 0.004, 0);
            blackShape.setLocalEulerAngles(-180, 0, 0);
            blackShape.setLocalScale(primitiveScale);
            light.addChild(blackShape);
        }

        return light;
    }

    // set the loaded area light LUT data
    const luts = assets.luts.resource;
    app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // create ground plane
    const ground = createPrimitive('plane', new pc.Vec3(0, 0, 0), new pc.Vec3(45, 1, 45), assets);

    // Create the camera, which renders entities
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1),
        fov: 60,
        farClip: 1000
    });
    camera.setLocalPosition(3, 3, 12);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: ground,
            distanceMax: 60,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // add bloom postprocessing
    camera.script.create('bloom', {
        attributes: {
            bloomIntensity: 1.5,
            bloomThreshold: 0.6,
            blurAmount: 6
        }
    });

    // generate a grid of area lights of sphere, disk and rect shapes
    for (let x = -20; x <= 20; x += 5) {
        for (let y = -20; y <= 20; y += 5) {
            const pos = new pc.Vec3(x, 0.6, y);
            const color = new pc.Color(0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7);
            const rand = Math.random();
            if (rand < 0.3) {
                createAreaLight('omni', pc.LIGHTSHAPE_SPHERE, pos, new pc.Vec3(1.5, 1.5, 1.5), color, 2, 6);
            } else if (rand < 0.6) {
                createAreaLight('spot', pc.LIGHTSHAPE_DISK, pos, new pc.Vec3(1.5, 1.5, 1.5), color, 2.5, 5);
            } else {
                createAreaLight('spot', pc.LIGHTSHAPE_RECT, pos, new pc.Vec3(2, 1, 1), color, 2.5, 5);
            }
        }
    }

    // handle HUD changes - update properties on the material
    data.on('*:set', (/** @type {string} */ path, value) => {
        const pathArray = path.split('.');
        if (pathArray[2] === 'gloss') groundMaterial.gloss = value;
        if (pathArray[2] === 'metalness') groundMaterial.metalness = value;
        groundMaterial.update();
    });
});

export { app };
