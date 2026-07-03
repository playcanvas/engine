import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LAYERID_DEPTH,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import shaderGlslFrag from './shader.glsl.frag';
import shaderGlslVert from './shader.glsl.vert';
import shaderWgslFrag from './shader.wgsl.frag';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    normal: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' }),
    roughness: new Asset('roughness', 'texture', { url: './assets/textures/pc-gray.png' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
createOptions.resourceHandlers = [TextureHandler];

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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// setup skydome
app.scene.skyboxMip = 0;
app.scene.exposure = 2;
app.scene.envAtlas = assets.helipad.resource;

// Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
// Move the depth layer to take place after World and Skydome layers, to capture both of them.
const depthLayer = app.scene.layers.getLayerById(LAYERID_DEPTH);
app.scene.layers.remove(depthLayer);
app.scene.layers.insertOpaque(depthLayer, 2);

/**
 * Helper function to create a primitive with shape type, position, scale, color.
 *
 * @param {string} primitiveType - The primitive type.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @param {Color} color - The color.
 * @returns {Entity} - The created primitive entity.
 */
function createPrimitive(primitiveType, position, scale, color) {
    // create material of specified color
    const material = new StandardMaterial();
    material.diffuse = color;
    material.gloss = 0.6;
    material.metalness = 0.4;
    material.useMetalness = true;
    material.update();

    // create primitive
    const primitive = new Entity();
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
 * create few primitives, keep their references to rotate them later
 * @type {Entity[]}
 */
const primitives = [];
const count = 7;
const shapes = ['box', 'cone', 'cylinder', 'sphere', 'capsule'];
for (let i = 0; i < count; i++) {
    const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
    const color = new Color(Math.random(), Math.random(), Math.random());
    const angle = (2 * Math.PI * i) / count;
    const pos = new Vec3(12 * Math.sin(angle), 0, 12 * Math.cos(angle));
    primitives.push(createPrimitive(shapeName, pos, new Vec3(4, 8, 4), color));
}

// Create the camera, which renders entities
const camera = new Entity('SceneCamera');
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);
camera.setLocalPosition(0, 10, 20);
camera.lookAt(Vec3.ZERO);

// enable the camera to render the scene's color map.
camera.camera.requestSceneColorMap(true);

// create a primitive which uses refraction shader to distort the view behind it
const glass = createPrimitive('box', new Vec3(1, 3, 0), new Vec3(10, 10, 10), new Color(1, 1, 1));
glass.render.castShadows = false;
glass.render.receiveShadows = false;

// reflection material using the shader
const refractionMaterial = new ShaderMaterial({
    uniqueName: 'RefractionShader',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        vertex_position: SEMANTIC_POSITION,
        vertex_texCoord0: SEMANTIC_TEXCOORD0
    }
});
glass.render.material = refractionMaterial;

// set an offset map on the material
refractionMaterial.setParameter('uOffsetMap', assets.normal.resource);

// set roughness map
refractionMaterial.setParameter('uRoughnessMap', assets.roughness.resource);

// tint colors
refractionMaterial.setParameter(
    'tints[0]',
    new Float32Array([
        1,
        0.7,
        0.7, // red
        1,
        1,
        1, // white
        0.7,
        0.7,
        1, // blue
        1,
        1,
        1 // white
    ])
);

// transparency
refractionMaterial.blendType = BLEND_NORMAL;
refractionMaterial.update();

// update things each frame
let time = 0;
app.on('update', dt => {
    time += dt;

    // rotate the primitives
    primitives.forEach(prim => {
        prim.rotate(0.3, 0.2, 0.1);
    });

    glass.rotate(-0.1, 0.1, -0.15);

    // orbit the camera
    camera.setLocalPosition(20 * Math.sin(time * 0.2), 7, 20 * Math.cos(time * 0.2));
    camera.lookAt(new Vec3(0, 2, 0));
});
