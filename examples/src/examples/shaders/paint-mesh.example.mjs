import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    CubemapHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Layer,
    LightComponentSystem,
    Mat4,
    Mesh,
    MeshInstance,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    SphereGeometry,
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

// load the textures
const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    color: new Asset('color', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' }, { srgb: true }),
    decal: new Asset('color', 'texture', { url: './assets/textures/heart.png' }, { srgb: true })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, CubemapHandler];

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

app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxIntensity = 1;
app.scene.skyboxMip = 2;

/**
 * helper function to create high polygon version of a sphere and sets up an entity to allow it to be added to the scene
 * @param {Material} material - The material.
 * @param {number[]} layer - The render component's layers.
 * @returns {Entity} The returned entity.
 */
const createHighQualitySphere = (material, layer) => {
    // Create Entity and add it to the scene
    const entity = new Entity('HighResSphere');
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

// We render decals to a texture, so create a render target for it. Note that the texture needs
// to be of renderable format here, and so it cannot be compressed.
const texture = assets.color.resource;
const renderTarget = new RenderTarget({
    colorBuffer: texture,
    depth: false
});

// create a layer for rendering to decals
const decalLayer = new Layer({ name: 'decalLayer' });
app.scene.layers.insert(decalLayer, 0);

// Create a camera, which renders decals using a decalLayer, and renders before the main camera
// Note that this camera does not need its position set, as it's only used to trigger
// the rendering, but the camera matrix is not used for the rendering (our custom shader
// does not need it).
const decalCamera = new Entity('DecalCamera');
decalCamera.addComponent('camera', {
    clearColorBuffer: false,
    layers: [decalLayer.id],
    renderTarget: renderTarget,
    priority: -1,
    toneMapping: TONEMAP_ACES
});
app.root.addChild(decalCamera);

// Create main camera, which renders entities in world layer - this is where we show mesh with decals
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1, 1),
    toneMapping: TONEMAP_ACES
});
camera.translate(20, 10, 40);
camera.lookAt(new Vec3(0, -7, 0));
app.root.addChild(camera);

// material used on the sphere
const material = new StandardMaterial();
material.diffuseMap = texture;
material.gloss = 0.6;
material.metalness = 0.4;
material.useMetalness = true;
material.update();

// sphere with the texture
const worldLayer = app.scene.layers.getLayerByName('World');
const meshEntity = createHighQualitySphere(material, [worldLayer.id]);
meshEntity.setLocalScale(15, 15, 15);

// Create a decal material with a custom shader
const decalMaterial = new ShaderMaterial({
    uniqueName: 'DecalShader',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        aPosition: SEMANTIC_POSITION,
        aUv0: SEMANTIC_TEXCOORD0
    }
});
decalMaterial.cull = CULLFACE_NONE;
decalMaterial.blendType = BLEND_NORMAL;
decalMaterial.setParameter('uDecalMap', assets.decal.resource);

// To render into uv space of the mesh, we need to render the mesh using our custom shader into
// the texture. In order to do this, we creates a new entity, containing the same mesh instances,
// but using our custom shader. We make it a child of the original entity, to use its transform.
const meshInstances = meshEntity.render.meshInstances.map(srcMeshInstance => {
    return new MeshInstance(srcMeshInstance.mesh, decalMaterial);
});
const cloneEntity = new Entity('cloneEntity');
cloneEntity.addComponent('render', {
    meshInstances: meshInstances,
    layers: [decalLayer.id],
    castShadows: false,
    receiveShadows: false
});
meshEntity.addChild(cloneEntity);

// Create an entity with a directional light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    intensity: 3
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 90, 0);

// update things each frame
let time = 0;
let decalTime = 0;
const decalFrequency = 0.5;
app.on('update', dt => {
    time += dt * 0.7;

    // a decal projection box is an orthographic projection from some position. We calculate position
    // here to be in an orbit around the sphere. Draw a line showing the projection point and direction.
    const decalProjectionPos = new Vec3(8 * Math.cos(time), 8 * Math.cos(time * 0.3), 8 * Math.sin(time));
    app.drawLine(decalProjectionPos, Vec3.ZERO, Color.WHITE);

    // render recal every half a second
    decalTime += dt;
    if (decalTime > decalFrequency) {
        decalTime -= decalFrequency;

        // enable decal camera, which renders the decal
        decalCamera.enabled = true;

        // construct a view matrix, looking from the decal position to the center of the sphere
        const viewMatrix = new Mat4().setLookAt(decalProjectionPos, Vec3.ZERO, Vec3.UP);
        viewMatrix.invert();

        // ortographics projection matrix - this defines the size of the decal, but also its depth range (0..5)
        const projMatrix = new Mat4().setOrtho(-1, 1, -1, 1, 0, 5);

        // final matrix is a combination of view and projection matrix. Make it available to the shader.
        const viewProj = new Mat4();
        viewProj.mul2(projMatrix, viewMatrix);
        decalMaterial.setParameter('matrix_decal_viewProj', viewProj.data);
    } else {
        // otherwise the decal camera is disabled
        decalCamera.enabled = false;
    }

    // draw the texture we render decals to for demonstration purposes
    // @ts-ignore engine-tsd
    app.drawTexture(0, -0.6, 1.4, 0.6, texture);
});
