import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Layer,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderMaterial,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import shaderGlslFrag from './shader.glsl.frag';
import shaderGlslVert from './shader.glsl.vert';
import shaderWgslFrag from './shader.wgsl.frag';
import shaderWgslVert from './shader.wgsl.vert';

/**
 * @import { Material } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    envatlas: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    script: new Asset('script', 'script', { url: './scripts/utils/planar-renderer.js' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup skydome
app.scene.envAtlas = assets.envatlas.resource;
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 1.7; // make it brighter

/**
 * Helper function to create a primitive with shape type, position, scale, color and layer.
 *
 * @param {string} primitiveType - Type of the primitive to create.
 * @param {Vec3} position - The position of the primitive.
 * @param {Vec3} scale - The scale of the primitive.
 * @param {Color} color - The color of the primitive.
 * @param {number[]} layer - The layer to render the primitive into.
 * @param {Material | StandardMaterial | null} [material] - The material to use for the primitive.
 * @returns {Entity} The created entity.
 */
function createPrimitive(primitiveType, position, scale, color, layer, material = null) {
    // Create material of specified color
    if (!material) {
        const standardMaterial = new StandardMaterial();
        standardMaterial.diffuse = color;
        standardMaterial.gloss = 0.6;
        standardMaterial.metalness = 0.7;
        standardMaterial.useMetalness = true;
        standardMaterial.update();
        material = standardMaterial;
    }

    // Create primitive
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        layers: layer,
        material: material
    });

    // Set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);

    return primitive;
}

// Get existing layers
const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const uiLayer = app.scene.layers.getLayerByName('UI');

// Create a layer for objects that do not render into texture
const excludedLayer = new Layer({ name: 'Excluded' });
app.scene.layers.insert(excludedLayer, app.scene.layers.getTransparentIndex(worldLayer) + 1);

// Create the shader from the vertex and fragment shaders
// Reflective ground
// This is in the excluded layer so it does not render into reflection texture
const groundMaterial = new ShaderMaterial({
    uniqueName: 'MyShader',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        aPosition: SEMANTIC_POSITION,
        aUv0: SEMANTIC_TEXCOORD0
    }
});
createPrimitive(
    'plane',
    new Vec3(0, 0, 0),
    new Vec3(40, 1, 40),
    new Color(0.5, 0.5, 0.5),
    [excludedLayer.id],
    groundMaterial
);

// Get the instance of the statue and set up with render component
const statueEntity = assets.statue.resource.instantiateRenderEntity();
app.root.addChild(statueEntity);

/**
 * create few random primitives in the world layer
 * @type {Entity[]}
 */
const entities = [];
const shapes = ['box', 'cone', 'cylinder', 'sphere', 'capsule'];
for (let i = 0; i < 6; i++) {
    const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
    const color = new Color(Math.random(), Math.random(), Math.random());
    entities.push(createPrimitive(shapeName, Vec3.ZERO, new Vec3(3, 3, 3), color, [worldLayer.id]));
}

// Create main camera, which renders entities in world, excluded and skybox layers
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    fov: 60,
    layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id, uiLayer.id],
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

// Create reflection camera, which renders entities in world and skybox layers only
const reflectionCamera = new Entity('ReflectionCamera');
reflectionCamera.addComponent('camera', {
    fov: 60,
    layers: [worldLayer.id, skyboxLayer.id],
    priority: -1, // render reflections before the main camera
    toneMapping: TONEMAP_ACES
});

// Add planarRenderer script which renders the reflection texture
reflectionCamera.addComponent('script');
reflectionCamera.script.create('planarRenderer', {
    attributes: {
        sceneCameraEntity: camera,
        scale: 1,
        mipmaps: false,
        depth: true,
        planePoint: Vec3.ZERO,
        planeNormal: Vec3.UP
    }
});
app.root.addChild(reflectionCamera);

// Update things each frame
let time = 0;
app.on('update', (dt) => {
    time += dt;

    // Rotate primitives around their center and also orbit them around the shiny sphere
    for (let e = 0; e < entities.length; e++) {
        const scale = (e + 1) / entities.length;
        const offset = time + e * 200;
        entities[e].setLocalPosition(7 * Math.sin(offset), e + 5, 7 * Math.cos(offset));
        entities[e].rotate(1 * scale, 2 * scale, 3 * scale);
    }

    // Slowly orbit camera around
    camera.setLocalPosition(30 * Math.cos(time * 0.2), 10, 30 * Math.sin(time * 0.2));
    camera.lookAt(Vec3.ZERO);

    // Animate FOV
    camera.camera.fov = 60 + 20 * Math.sin(time * 0.5);

    // Trigger reflection camera update (must be called after all parameters of the main camera are updated)
    // @ts-ignore engine-tsd
    const reflectionTexture = reflectionCamera.script.planarRenderer.frameUpdate();
    groundMaterial.setParameter('uDiffuseMap', reflectionTexture);
    groundMaterial.update();
});
