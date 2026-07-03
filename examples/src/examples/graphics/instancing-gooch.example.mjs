// @config
//
// This example demonstrates how a custom shader can be used to render instanced geometry, but also
// skinned, morphed and static geometry. A simple Gooch shading shader is used.
//
// @credit
// title: Low-poly Tree with Twisting Branches
// author: Sketchfab
// source: https://sketchfab.com/3d-models/low-poly-tree-with-twisting-branches-4e2589134f2442bcbdab51c1f306cd58
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AnimClipHandler,
    AnimComponentSystem,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_ATTR12,
    SEMANTIC_ATTR13,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TYPE_FLOAT32,
    TextureHandler,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';

import { createGoochMaterial } from 'examples/assets/scripts/misc/gooch-material.mjs';
import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    tree: new Asset('cube', 'container', { url: './assets/models/low-poly-tree.glb' }),

    bitmoji: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    danceAnim: new Asset('walkAnim', 'container', { url: './assets/animations/bitmoji/win-dance.glb' }),

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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, AnimComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, AnimClipHandler];

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

// A helper function to apply a material to all mesh instances of an entity
const applyMaterial = (entity, materials) => {
    entity.findComponents('render').forEach(render => {
        render.meshInstances.forEach(meshInstance => {
            const goochMaterial = createGoochMaterial(meshInstance.material.diffuseMap);
            meshInstance.material = goochMaterial;
            materials.push(goochMaterial);
        });
    });
};

// Setup skydome
app.scene.skyboxMip = 2;
app.scene.envAtlas = assets.helipad.resource;

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

// Number of instanced trees to render
const instanceCount = 500;

// Create static vertex buffer containing the instancing data
const vbFormat = new VertexFormat(app.graphicsDevice, [
    { semantic: SEMANTIC_ATTR12, components: 3, type: TYPE_FLOAT32 }, // position
    { semantic: SEMANTIC_ATTR13, components: 1, type: TYPE_FLOAT32 } // scale
]);

// Store data for individual instances into array, 4 floats each
const data = new Float32Array(instanceCount * 4);

for (let i = 0; i < instanceCount; i++) {
    // Random points in the ring
    const radius0 = 2;
    const radius1 = 10;
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.sqrt(Math.random() * (radius1 ** 2 - radius0 ** 2) + radius0 ** 2);
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    const offset = i * 4;
    data[offset + 0] = x; // x
    data[offset + 1] = 1; // y
    data[offset + 2] = z; // z
    data[offset + 3] = 0.03 + Math.random() * 0.25; // scale
}

const vertexBuffer = new VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
    data: data
});

// Create a forest by instantiating a tree model and setting it up for instancing
const forest = assets.tree.resource.instantiateRenderEntity();
app.root.addChild(forest);

// Find the mesh instance we want to instantiate, and swap its material for the custom gooch material,
// while preserving its texture
const meshInstance = forest.findComponent('render').meshInstances[0];
const material = createGoochMaterial(meshInstance.material.diffuseMap);
meshInstance.material = material;

// initialize instancing using the vertex buffer on meshInstance
meshInstance.setInstancing(vertexBuffer);

// Create an Entity for the ground - this is a static geometry. Create a new instance of the gooch material,
// without a texture.
const ground = new Entity('Ground');
const groundMaterial = createGoochMaterial(null, [0.13, 0.55, 0.13]); // no texture
ground.addComponent('render', {
    type: 'box',
    material: groundMaterial
});
ground.setLocalScale(30, 1, 30);
ground.setLocalPosition(0, -0.5, 0);
app.root.addChild(ground);

// store al materials to allow for easy modification
const materials = [material, groundMaterial];

// animated / morphed bitmoji model
const bitmojiEntity = assets.bitmoji.resource.instantiateRenderEntity({ castShadows: false });
bitmojiEntity.setLocalScale(2.5, 2.5, 2.5);
bitmojiEntity.setLocalPosition(0, 0, 0);
app.root.addChild(bitmojiEntity);
applyMaterial(bitmojiEntity, materials);

// play the animation
bitmojiEntity.addComponent('anim', { activate: true });
const walkTrack = assets.danceAnim.resource.animations[0].resource;
bitmojiEntity.anim.assignAnimation('Walk', walkTrack, undefined, 0.62);

// Set an update function on the app's update event
let time = 0;
app.on('update', dt => {
    time += dt;

    // generate a light direction that rotates around the scene, and set it on the materials
    const lightDir = new Vec3(Math.sin(time), -0.5, Math.cos(time)).normalize();
    const lightDirArray = [-lightDir.x, -lightDir.y, -lightDir.z];

    materials.forEach(mat => {
        mat.setParameter('uLightDir', lightDirArray);
        mat.update();
    });

    // orbit the camera
    camera.setLocalPosition(8 * Math.sin(time * 0.01), 3, 8 * Math.cos(time * 0.01));
    camera.lookAt(new Vec3(0, 1, 0));
});
