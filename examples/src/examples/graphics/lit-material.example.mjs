// @config HIDDEN
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/arial.json' }),
    color: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' }),
    normal: new pc.Asset('normal', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-normal.jpg' }),
    gloss: new pc.Asset('gloss', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-gloss.jpg' })
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
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.JsonHandler,
    pc.FontHandler
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

    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMin: 2,
            distanceMax: 15
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    camera.translate(0, 1, 4);
    camera.lookAt(0, 0, 0);
    app.root.addChild(camera);

    // Create an Entity with a omni light component and a sphere model component.
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'omni',
        color: pc.Color.WHITE,
        intensity: 1,
        range: 10
    });
    light.translate(0, 1, 0);
    app.root.addChild(light);

    const material = new pc.LitMaterial();
    material.setParameter('texture_envAtlas', assets.helipad.resource);
    material.setParameter('material_reflectivity', 1.0);
    material.setParameter('material_normalMapIntensity', 1.0);
    material.setParameter('texture_diffuseMap', assets.color.resource);
    material.setParameter('texture_glossMap', assets.gloss.resource);
    material.setParameter('texture_normalMap', assets.normal.resource);
    material.useSkybox = true;
    material.hasSpecular = true;
    material.hasSpecularityFactor = true;
    material.hasNormals = true;
    material.hasMetalness = true;
    material.occludeSpecular = pc.SPECOCC_AO;

    const argumentsChunk = `
        uniform sampler2D texture_diffuseMap;
        uniform sampler2D texture_glossMap;
        uniform sampler2D texture_normalMap;
        uniform float material_normalMapIntensity;
        uniform vec3 material_specularRgb;
        void evaluateFrontend() {
            litArgs_emission = vec3(0, 0, 0);
            litArgs_metalness = 0.5;
            litArgs_specularity = material_specularRgb;
            litArgs_specularityFactor = 1.0;
            litArgs_gloss = texture2D(texture_glossMap, vUv0).r;

            litArgs_ior = 0.1;

            vec3 normalMap = texture2D(texture_normalMap, vUv0).xyz * 2.0 - 1.0;
            litArgs_worldNormal = normalize(dTBN * mix(vec3(0,0,1), normalMap, material_normalMapIntensity));
            litArgs_albedo = vec3(0.5) + texture2D(texture_diffuseMap, vUv0).xyz;

            litArgs_ao = 0.0;
            litArgs_opacity = 1.0;
        }`;
    material.shaderChunk = argumentsChunk;
    material.update();

    // create primitive
    const primitive = new pc.Entity();
    primitive.addComponent('render', {
        type: 'sphere',
        material: material
    });

    // set position and scale and add it to scene
    app.root.addChild(primitive);

    let time = 0;
    app.on('update', function (/** @type {number} */ dt) {
        time += dt;
        material.setParameter('material_specularRgb', [
            (Math.sin(time) + 1.0) * 0.5,
            (Math.cos(time * 0.5) + 1.0) * 0.5,
            (Math.sin(time * 0.7) + 1.0) * 0.5
        ]);
        material.setParameter('material_normalMapIntensity', (Math.sin(time) + 1.0) * 0.5);
    });
});

export { app };
