import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    color: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' }),
    normal: new pc.Asset('normal', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-normal.jpg' }),
    gloss: new pc.Asset('gloss', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
    statue: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/statue.glb' }),
    luts: new pc.Asset('luts', 'json', { url: rootPath + '/static/assets/json/area-light-luts.json' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.JsonHandler, pc.CubemapHandler];

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
    /**
     * helper function to create a primitive with shape type, position, scale, color
     * @param {string} primitiveType - The primitive type.
     * @param {pc.Vec3} position - The position.
     * @param {pc.Vec3} scale - The scale.
     * @param {pc.Color} color - The color.
     * @param {any} assetManifest - The asset manifest.
     * @returns {pc.Entity} The returned entity.
     */
    function createPrimitive(primitiveType, position, scale, color, assetManifest) {
        // create material of specified color
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.gloss = 0.8;
        material.useMetalness = true;

        if (assetManifest) {
            material.diffuseMap = assetManifest.color.resource;
            material.normalMap = assetManifest.normal.resource;
            material.glossMap = assetManifest.gloss.resource;
            material.metalness = 0.7;

            material.diffuseMapTiling.set(7, 7);
            material.normalMapTiling.set(7, 7);
            material.glossMapTiling.set(7, 7);
        }

        material.update();

        // create primitive
        const primitive = new pc.Entity();
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

    /**
     * Helper function to create area light including its visual representation in the world.
     * @param {string} type - The light component's type.
     * @param {number} shape - The light component's shape.
     * @param {pc.Vec3} position - The position.
     * @param {number} scale - The scale.
     * @param {pc.Color} color - The color.
     * @param {number} intensity - The light component's intensity.
     * @param {boolean} shadows - Casting shadows or not.
     * @param {number} range - The light component's range.
     * @returns {pc.Entity} The returned entity.
     */
    function createAreaLight(type, shape, position, scale, color, intensity, shadows, range) {
        const lightParent = new pc.Entity();
        lightParent.translate(position);
        app.root.addChild(lightParent);

        const light = new pc.Entity();
        light.addComponent('light', {
            type: type,
            shape: shape,
            color: color,
            intensity: intensity,
            falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
            range: range,
            castShadows: shadows,
            innerConeAngle: 80,
            outerConeAngle: 85,
            shadowBias: 0.1,
            normalOffsetBias: 0.1,
            shadowResolution: 2048
        });

        light.setLocalScale(scale, scale, scale);
        lightParent.addChild(light);

        // emissive material that is the light source color
        const brightMaterial = new pc.StandardMaterial();
        brightMaterial.emissive = color;
        brightMaterial.useLighting = false;
        brightMaterial.cull = shape === pc.LIGHTSHAPE_RECT ? pc.CULLFACE_NONE : pc.CULLFACE_BACK;
        brightMaterial.update();

        const brightShape = new pc.Entity();
        // primitive shape that matches light source shape
        brightShape.addComponent('render', {
            type: shape === pc.LIGHTSHAPE_SPHERE ? 'sphere' : shape === pc.LIGHTSHAPE_DISK ? 'cone' : 'plane',
            material: brightMaterial,
            castShadows: type !== 'directional'
        });
        brightShape.setLocalScale(
            type === 'directional' ? scale * range : scale,
            shape === pc.LIGHTSHAPE_DISK ? 0.001 : type === 'directional' ? scale * range : scale,
            type === 'directional' ? scale * range : scale
        );
        lightParent.addChild(brightShape);

        // add black primitive shape if not omni-directional or global directional
        if (type === 'spot') {
            // black material
            const blackMaterial = new pc.StandardMaterial();
            blackMaterial.diffuse = new pc.Color(0, 0, 0);
            blackMaterial.useLighting = false;
            blackMaterial.cull = shape === pc.LIGHTSHAPE_RECT ? pc.CULLFACE_NONE : pc.CULLFACE_BACK;
            blackMaterial.update();

            const blackShape = new pc.Entity();
            blackShape.addComponent('render', {
                type: shape === pc.LIGHTSHAPE_SPHERE ? 'sphere' : shape === pc.LIGHTSHAPE_DISK ? 'cone' : 'plane',
                material: blackMaterial
            });
            blackShape.setLocalPosition(0, 0.01 / scale, 0);
            blackShape.setLocalEulerAngles(-180, 0, 0);
            brightShape.addChild(blackShape);
        }

        return lightParent;
    }

    const far = 5000.0;

    app.start();

    // enable area lights which are disabled by default for clustered lighting
    app.scene.lighting.areaLightsEnabled = true;

    // set the loaded area light LUT data
    const luts = assets.luts.resource;
    app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // setup skydome
    app.scene.skyboxMip = 1; // use top mipmap level of cubemap (full resolution)
    app.scene.skyboxIntensity = 0.4; // make it darker
    app.scene.envAtlas = assets.helipad.resource;

    // create ground plane
    createPrimitive('plane', new pc.Vec3(0, 0, 0), new pc.Vec3(20, 20, 20), new pc.Color(0.3, 0.3, 0.3), assets);

    // get the instance of the statue and set up with render component
    const statue = assets.statue.resource.instantiateRenderEntity();
    statue.setLocalScale(0.4, 0.4, 0.4);
    app.root.addChild(statue);

    // Create the camera, which renders entities
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 60,
        farClip: 100000
    });
    app.root.addChild(camera);
    camera.setLocalPosition(0, 2.5, 12);
    camera.lookAt(0, 0, 0);

    // Create lights with light source shape
    const light1 = createAreaLight(
        'spot',
        pc.LIGHTSHAPE_RECT,
        new pc.Vec3(-3, 4, 0),
        4,
        new pc.Color(1, 1, 1),
        2,
        true,
        10
    );
    const light2 = createAreaLight(
        'omni',
        pc.LIGHTSHAPE_SPHERE,
        new pc.Vec3(5, 2, -2),
        2,
        new pc.Color(1, 1, 0),
        2,
        false,
        10
    );
    const light3 = createAreaLight(
        'directional',
        pc.LIGHTSHAPE_DISK,
        new pc.Vec3(0, 0, 0),
        0.2,
        new pc.Color(0.7, 0.7, 1),
        10,
        true,
        far
    );

    // update things each frame
    let time = 0;
    app.on('update', function (/** @type {number} */ dt) {
        time += dt;

        const factor1 = (Math.sin(time) + 1) * 0.5;
        const factor2 = (Math.sin(time * 0.6) + 1) * 0.5;
        const factor3 = (Math.sin(time * 0.4) + 1) * 0.5;

        if (light1) {
            light1.setLocalEulerAngles(pc.math.lerp(-90, 110, factor1), 0, 90);
            light1.setLocalPosition(-4, pc.math.lerp(2, 4, factor3), pc.math.lerp(-2, 2, factor2));
        }

        if (light2) {
            light2.setLocalPosition(5, pc.math.lerp(1, 3, factor1), pc.math.lerp(-2, 2, factor2));
        }

        if (light3) {
            light3.setLocalEulerAngles(pc.math.lerp(230, 310, factor2), pc.math.lerp(-30, 0, factor3), 90);

            const dir = light3.getWorldTransform().getY();
            const campos = camera.getPosition();

            light3.setPosition(campos.x + dir.x * far, campos.y + dir.y * far, campos.z + dir.z * far);
        }
    });
});

export { app };
