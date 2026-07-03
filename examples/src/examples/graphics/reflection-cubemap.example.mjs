import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    Layer,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    PIXELFORMAT_RGB8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    SphereGeometry,
    StandardMaterial,
    TEXTUREPROJECTION_EQUIRECT,
    TEXTUREPROJECTION_OCTAHEDRAL,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    Vec3,
    createGraphicsDevice,
    reprojectTexture
} from 'playcanvas';

import { deviceType } from 'examples/context';

/**
 * @import { Material } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    script: new Asset('script', 'script', { url: './scripts/utils/cubemap-renderer.js' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

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
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 0; // use top mipmap level of cubemap (full resolution)
app.scene.skyboxIntensity = 2; // make it brighter

/**
 * helper function to create high polygon version of a sphere and sets up an entity to allow it to be added to the scene
 * @param {Material} material - The material.
 * @param {number[]} layer - The render component's layers.
 * @returns {Entity} The returned entity.
 */
const createHighQualitySphere = (material, layer) => {
    // Create Entity and add it to the scene
    const entity = new Entity('ShinyBall');
    app.root.addChild(entity);

    // create hight resolution sphere
    const mesh = Mesh.fromGeometry(app.graphicsDevice, new SphereGeometry({ latitudeBands: 200, longitudeBands: 200 }));

    // Add a render component with the mesh
    entity.addComponent('render', {
        type: 'asset',
        layers: layer,
        meshInstances: [new MeshInstance(mesh, material)]
    });

    return entity;
};

/**
 * helper function to create a primitive with shape type, position, scale, color and layer
 * @param {string} primitiveType - The primitive type.
 * @param {number | Vec3} position - The entity's position.
 * @param {number | Vec3} scale - The entisy's scale.
 * @param {Color} color - The color.
 * @param {number[]} layer - The render component's layers.
 * @returns {Entity} The returned entity.
 */
function createPrimitive(primitiveType, position, scale, color, layer) {
    // create material of specified color
    const material = new StandardMaterial();
    material.diffuse = color;
    material.gloss = 0.6;
    material.metalness = 0.7;
    material.useMetalness = true;
    material.update();

    // create primitive
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        layers: layer,
        material: material
    });

    // set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);

    return primitive;
}

// get existing layers
const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const immediateLayer = app.scene.layers.getLayerByName('Immediate');
const uiLayer = app.scene.layers.getLayerByName('UI');

// create a layer for object that do not render into texture
const excludedLayer = new Layer({ name: 'Excluded' });
app.scene.layers.push(excludedLayer);

// create material for the shiny ball
const shinyMat = new StandardMaterial();

// create shiny ball mesh - this is on excluded layer as it does not render to cubemap
const shinyBall = createHighQualitySphere(shinyMat, [excludedLayer.id]);
shinyBall.setLocalPosition(0, 0, 0);
shinyBall.setLocalScale(10, 10, 10);

// add camera component to shiny ball - this defines camera properties for cubemap rendering
shinyBall.addComponent('camera', {
    // optimization - clear the surface even though all pixels are overwritten,
    // as this has performance benefits on tiled architectures
    clearColorBuffer: true,

    // cubemap camera will render objects on world layer and also skybox
    layers: [worldLayer.id, skyboxLayer.id],

    // priority - render before world camera
    priority: -1,

    // disable as this is not a camera that renders cube map but only a container for properties for cube map rendering
    enabled: false,

    toneMapping: TONEMAP_ACES
});

// add cubemapRenderer script component which takes care of rendering dynamic cubemap
shinyBall.addComponent('script');
shinyBall.script.create('cubemapRenderer', {
    attributes: {
        resolution: 256,
        mipmaps: true,
        depth: true
    }
});

// finish set up of shiny material - make reflection a bit darker
shinyMat.diffuse = new Color(0.6, 0.6, 0.6);

// use cubemap which is generated by cubemapRenderer instead of global skybox cubemap
shinyMat.useSkybox = false;
// @ts-ignore engine-tsd
shinyMat.cubeMap = shinyBall.script.cubemapRenderer.cubeMap;

// make it shiny without diffuse component
shinyMat.metalness = 1;
shinyMat.useMetalness = true;
shinyMat.update();

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

// create green plane as a base to cast shadows on
createPrimitive('plane', new Vec3(0, -8, 0), new Vec3(20, 20, 20), new Color(0.3, 0.5, 0.3), [worldLayer.id]);

// Create main camera, which renders entities in world, excluded and skybox layers
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    fov: 60,
    layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id, immediateLayer.id, uiLayer.id],
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

// Create an Entity with a directional light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: Color.YELLOW,
    range: 40,
    castShadows: true,
    layers: [worldLayer.id],
    shadowBias: 0.2,
    shadowResolution: 1024,
    normalOffsetBias: 0.05,
    shadowDistance: 40
});
app.root.addChild(light);

/**
 * helper function to create a texture that can be used to project cubemap to
 * @param {string} projection - The texture's projection.
 * @param {number} size - Width and height of texture.
 * @returns {Texture} The texture.
 */
function createReprojectionTexture(projection, size) {
    return new Texture(app.graphicsDevice, {
        width: size,
        height: size,
        format: PIXELFORMAT_RGB8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        projection: projection
    });
}

// create 2 uqirect and 2 octahedral textures
const textureEqui = createReprojectionTexture(TEXTUREPROJECTION_EQUIRECT, 256);
const textureEqui2 = createReprojectionTexture(TEXTUREPROJECTION_EQUIRECT, 256);
const textureOcta = createReprojectionTexture(TEXTUREPROJECTION_OCTAHEDRAL, 64);
const textureOcta2 = createReprojectionTexture(TEXTUREPROJECTION_OCTAHEDRAL, 32);

// create one envAtlas texture
const textureAtlas = createReprojectionTexture(TEXTUREPROJECTION_OCTAHEDRAL, 512);

// update things each frame
let time = 0;
app.on('update', dt => {
    time += dt;

    // rotate primitives around their center and also orbit them around the shiny sphere
    for (let e = 0; e < entities.length; e++) {
        const scale = (e + 1) / entities.length;
        const offset = time + e * 200;
        entities[e].setLocalPosition(7 * Math.sin(offset), 2 * (e - 3), 7 * Math.cos(offset));
        entities[e].rotate(1 * scale, 2 * scale, 3 * scale);
    }

    // slowly orbit camera around
    camera.setLocalPosition(20 * Math.cos(time * 0.2), 2, 20 * Math.sin(time * 0.2));
    camera.lookAt(Vec3.ZERO);

    // project textures, and display them on the screen
    // @ts-ignore engine-tsd
    const srcCube = shinyBall.script.cubemapRenderer.cubeMap;

    // cube -> equi1
    reprojectTexture(srcCube, textureEqui, {
        numSamples: 1
    });
    // @ts-ignore engine-tsd
    app.drawTexture(-0.6, 0.7, 0.6, 0.3, textureEqui);

    // cube -> octa1
    reprojectTexture(srcCube, textureOcta, {
        numSamples: 1
    });
    // @ts-ignore engine-tsd
    app.drawTexture(0.7, 0.7, 0.4, 0.4, textureOcta);

    // equi1 -> octa2
    reprojectTexture(textureEqui, textureOcta2, {
        specularPower: 32,
        numSamples: 1024
    });
    // @ts-ignore engine-tsd
    app.drawTexture(-0.7, -0.7, 0.4, 0.4, textureOcta2);

    // octa1 -> equi2
    reprojectTexture(textureOcta, textureEqui2, {
        specularPower: 16,
        numSamples: 512
    });
    // @ts-ignore engine-tsd
    app.drawTexture(0.6, -0.7, 0.6, 0.3, textureEqui2);

    // cube -> envAtlas
    EnvLighting.generateAtlas(srcCube, {
        target: textureAtlas
    });
    // @ts-ignore engine-tsd
    app.drawTexture(0, -0.7, 0.5, 0.4, textureAtlas);
});
