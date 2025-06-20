// @config DESCRIPTION This example demonstrates how a custom shader can be used to render instanced geometry, but also skinned, morphed and static geometry. A simple Gooch shading shader is used.
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

// import the createGoochMaterial function from the gooch-material.mjs file
const { createGoochMaterial } = await fileImport(`${rootPath}/static/assets/scripts/misc/gooch-material.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    tree: new pc.Asset('cube', 'container', { url: `${rootPath}/static/assets/models/low-poly-tree.glb` }),

    bitmoji: new pc.Asset('model', 'container', { url: `${rootPath}/static/assets/models/bitmoji.glb` }),
    danceAnim: new pc.Asset('walkAnim', 'container', { url: `${rootPath}/static/assets/animations/bitmoji/win-dance.glb` }),

    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.AnimComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.AnimClipHandler
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

    // a helper function to apply a material to all mesh instances of an entity
    const applyMaterial = (entity, materials) => {
        entity.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((meshInstance) => {
                const goochMaterial = createGoochMaterial(meshInstance.material.diffuseMap);
                meshInstance.material = goochMaterial;
                materials.push(goochMaterial);
            });
        });
    };

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES
    });
    app.root.addChild(camera);

    // number of instanced trees to render
    const instanceCount = 500;

    // create static vertex buffer containing the instancing data
    const vbFormat = new pc.VertexFormat(app.graphicsDevice, [
        { semantic: pc.SEMANTIC_ATTR12, components: 3, type: pc.TYPE_FLOAT32 }, // position
        { semantic: pc.SEMANTIC_ATTR13, components: 1, type: pc.TYPE_FLOAT32 }  // scale
    ]);

    // store data for individual instances into array, 4 floats each
    const data = new Float32Array(instanceCount * 4);

    for (let i = 0; i < instanceCount; i++) {

        // random points in the ring
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

    const vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vbFormat, instanceCount, {
        data: data
    });

    // create a forest by instantiating a tree model and setting it up for instancing
    const forest = assets.tree.resource.instantiateRenderEntity();
    app.root.addChild(forest);

    // find the mesh instance we want to instantiate, and swap its material for the custom gooch material,
    // while preserving its texture
    const meshInstance = forest.findComponent('render').meshInstances[0];
    const material = createGoochMaterial(meshInstance.material.diffuseMap);
    meshInstance.material = material;

    // initialize instancing using the vertex buffer on meshInstance
    meshInstance.setInstancing(vertexBuffer);

    // Create an Entity for the ground - this is a static geometry. Create a new instance of the gooch material,
    // without a texture.
    const ground = new pc.Entity('Ground');
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
    app.on('update', (dt) => {
        time += dt;

        // generate a light direction that rotates around the scene, and set it on the materials
        const lightDir = new pc.Vec3(Math.sin(time), -0.5, Math.cos(time)).normalize();
        const lightDirArray = [-lightDir.x, -lightDir.y, -lightDir.z];

        materials.forEach((mat) => {
            mat.setParameter('uLightDir', lightDirArray);
            mat.update();
        });

        // orbit the camera
        camera.setLocalPosition(8 * Math.sin(time * 0.01), 3, 8 * Math.cos(time * 0.01));
        camera.lookAt(new pc.Vec3(0, 1, 0));
    });
});

export { app };
