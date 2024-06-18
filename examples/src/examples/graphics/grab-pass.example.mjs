import * as pc from 'playcanvas';
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    normal: new pc.Asset('normal', 'texture', { url: rootPath + '/static/assets/textures/normal-map.png' }),
    roughness: new pc.Asset('roughness', 'texture', { url: rootPath + '/static/assets/textures/pc-gray.png' }),
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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

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

    // setup skydome
    app.scene.skyboxMip = 0;
    app.scene.exposure = 2;
    app.scene.envAtlas = assets.helipad.resource;

    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
    // Move the depth layer to take place after World and Skydome layers, to capture both of them.
    const depthLayer = app.scene.layers.getLayerById(pc.LAYERID_DEPTH);
    app.scene.layers.remove(depthLayer);
    app.scene.layers.insertOpaque(depthLayer, 2);

    /**
     * Helper function to create a primitive with shape type, position, scale, color.
     *
     * @param {string} primitiveType - The primitive type.
     * @param {pc.Vec3} position - The position.
     * @param {pc.Vec3} scale - The scale.
     * @param {pc.Color} color - The color.
     * @returns {pc.Entity} - The created primitive entity.
     */
    function createPrimitive(primitiveType, position, scale, color) {
        // create material of specified color
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.gloss = 0.6;
        material.metalness = 0.4;
        material.useMetalness = true;
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
     * create few primitives, keep their references to rotate them later
     * @type {pc.Entity[]}
     */
    const primitives = [];
    const count = 7;
    const shapes = ['box', 'cone', 'cylinder', 'sphere', 'capsule'];
    for (let i = 0; i < count; i++) {
        const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
        const color = new pc.Color(Math.random(), Math.random(), Math.random());
        const angle = (2 * Math.PI * i) / count;
        const pos = new pc.Vec3(12 * Math.sin(angle), 0, 12 * Math.cos(angle));
        primitives.push(createPrimitive(shapeName, pos, new pc.Vec3(4, 8, 4), color));
    }

    // Create the camera, which renders entities
    const camera = new pc.Entity('SceneCamera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2)
    });
    app.root.addChild(camera);
    camera.setLocalPosition(0, 10, 20);
    camera.lookAt(pc.Vec3.ZERO);

    // enable the camera to render the scene's color map.
    camera.camera.requestSceneColorMap(true);

    // create a primitive which uses refraction shader to distort the view behind it
    const glass = createPrimitive('box', new pc.Vec3(1, 3, 0), new pc.Vec3(10, 10, 10), new pc.Color(1, 1, 1));
    glass.render.castShadows = false;
    glass.render.receiveShadows = false;

    const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader');

    // reflection material using the shader
    const refractionMaterial = new pc.Material();
    refractionMaterial.shader = shader;
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
    refractionMaterial.blendType = pc.BLEND_NORMAL;
    refractionMaterial.update();

    // update things each frame
    let time = 0;
    app.on('update', function (dt) {
        time += dt;

        // rotate the primitives
        primitives.forEach((prim) => {
            prim.rotate(0.3, 0.2, 0.1);
        });

        glass.rotate(-0.1, 0.1, -0.15);

        // orbit the camera
        camera.setLocalPosition(20 * Math.sin(time * 0.2), 7, 20 * Math.cos(time * 0.2));
        camera.lookAt(new pc.Vec3(0, 2, 0));
    });
});

export { app };
