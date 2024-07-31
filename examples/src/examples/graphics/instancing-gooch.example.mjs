import * as pc from 'playcanvas';
import { deviceType, rootPath, fileImport } from 'examples/utils';

// import the createGoochMaterial function from the gooch-material.mjs file
const { createGoochMaterial } = await fileImport(rootPath + '/static/assets/scripts/misc/gooch-material.mjs');

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    tree: new pc.Asset('cube', 'container', { url: rootPath + '/static/assets/models/low-poly-tree.glb' }),

    bitmoji: new pc.Asset('model', 'container', { url: rootPath + '/static/assets/models/bitmoji.glb' }),
    danceAnim: new pc.Asset('walkAnim', 'container', { url: rootPath + '/static/assets/animations/bitmoji/win-dance.glb' }),

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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.AnimComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler
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
    const applyMaterial = (entity, material) => {
        entity.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((meshInstance) => {
                meshInstance.material = material;
            });
        });
    };

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.exposure = 0.3;
    app.scene.envAtlas = assets.helipad.resource;

    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {});
    app.root.addChild(camera);

    // Move the camera back to see the cubes
    camera.translate(0, 0, 10);

    // number of instances to render
    const instanceCount = 150;

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
        const radius1 = 5;
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


    const cylinder = assets.tree.resource.instantiateRenderEntity();
    app.root.addChild(cylinder);

    const meshInstance = cylinder.findComponent('render').meshInstances[0];
    const texture = meshInstance.material.diffuseMap;
    const material = createGoochMaterial(texture);

    // initialize instancing using the vertex buffer on meshInstance of the created cylinder
    meshInstance.setInstancing(vertexBuffer);
    meshInstance.material = material;




    // Create an Entity for the ground
    const ground = new pc.Entity();
    const groundMaterial = createGoochMaterial(null, [0.13, 0.55, 0.13]); // no texture
    ground.addComponent('render', {
        type: 'box',
        material: groundMaterial
    });
    ground.setLocalScale(20, 1, 20);
    ground.setLocalPosition(0, -0.5, 0);
    app.root.addChild(ground);



    // add a non-instanced sphere, using the same material. A non-instanced version of the shader
    // is automatically created by the engine
    const sphere = new pc.Entity('sphere');
    const sphereMaterial = createGoochMaterial(null, [1, 0, 0]); // no texture
    sphere.addComponent('render', {
        type: 'sphere',
        material: sphereMaterial
    });
    sphere.setLocalScale(2, 1, 2);
    sphere.setLocalPosition(0, 0.5, 0);
    app.root.addChild(sphere);





    // animated / morphed bitmoji model
    const bitmojiEntity = assets.bitmoji.resource.instantiateRenderEntity({ castShadows: false });
    bitmojiEntity.setLocalScale(2, 2, 2);
    bitmojiEntity.setLocalPosition(0, 1, 0);
    app.root.addChild(bitmojiEntity);
    const bitmojiMaterial = createGoochMaterial(null, [1, 1, 0]);
    applyMaterial(bitmojiEntity, bitmojiMaterial);

    // play the animation
    bitmojiEntity.addComponent('anim', { activate: true });
    const walkTrack = assets.danceAnim.resource.animations[0].resource;
    bitmojiEntity.anim.assignAnimation('Walk', walkTrack, undefined, 0.62);



    // store al materials to allow for easy modification
    const materials = [material, groundMaterial, sphereMaterial, bitmojiMaterial];


    // Set an update function on the app's update event
    let time = 0;
    app.on('update', function (dt) {
        // orbit camera around
        time += dt;

        // generate a light direction that rotates around the scene, and set it on the materials
        const lightDir = new pc.Vec3(Math.sin(time), -0.5, Math.cos(time)).normalize();
        const lightDirArray = [-lightDir.x, -lightDir.y, -lightDir.z];

        materials.forEach((mat) => {
            mat.setParameter('uLightDir', lightDirArray);
            mat.update();
        });

        camera.setLocalPosition(8 * Math.sin(time * 0.01), 3, 8 * Math.cos(time * 0.01));
        camera.lookAt(new pc.Vec3(0, 1, 0));
    });
});

export { app };
