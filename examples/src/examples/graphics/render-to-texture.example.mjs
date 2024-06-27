import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Overview:
// There are 3 layers used:
// - worldLayer - it contains objects that render into main camera and also into texture
// - excludedLayer - it contains objects that are excluded from rendering into texture and so render only into main camera
// - skyboxLayer - it contains skybox and renders into both main and texture camera
// There are two cameras:
// - textureCamera - this camera renders into texture, objects from World and also Skybox layers
// - camera - this camera renders into main framebuffer, objects from World, Excluded and also Skybox layers

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    checkerboard: new pc.Asset('checkerboard', 'texture', { url: rootPath + '/static/assets/textures/checkboard.png' }),
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' })
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
    pc.ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ScriptHandler];

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

    /**
     * helper function to create a primitive with shape type, position, scale, color and layer
     * @param {string} primitiveType - The primitive type.
     * @param {number | pc.Vec3} position - The position.
     * @param {number | pc.Vec3} scale - The scale.
     * @param {pc.Color} color - The color.
     * @param {number[]} layer - The render component's layers.
     * @returns {pc.Entity} The returned entity.
     */
    function createPrimitive(primitiveType, position, scale, color, layer) {
        // create material of specified color
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.update();

        // create primitive
        const primitive = new pc.Entity();
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

    /**
     * helper function to create a basic particle system
     * @param {pc.Vec3} position - The position.
     */
    function createParticleSystem(position) {
        // make particles move in different directions
        const localVelocityCurve = new pc.CurveSet([
            [0, 0, 0.5, 8],
            [0, 0, 0.5, 8],
            [0, 0, 0.5, 8]
        ]);
        const localVelocityCurve2 = new pc.CurveSet([
            [0, 0, 0.5, -8],
            [0, 0, 0.5, -8],
            [0, 0, 0.5, -8]
        ]);

        // increasing gravity
        const worldVelocityCurve = new pc.CurveSet([
            [0, 0],
            [0, 0, 0.2, 6, 1, -48],
            [0, 0]
        ]);

        // Create entity for particle system
        const entity = new pc.Entity();
        app.root.addChild(entity);
        entity.setLocalPosition(position);

        // add particlesystem component to entity
        entity.addComponent('particlesystem', {
            numParticles: 200,
            lifetime: 1,
            rate: 0.01,
            scaleGraph: new pc.Curve([0, 0.5]),
            velocityGraph: worldVelocityCurve,
            localVelocityGraph: localVelocityCurve,
            localVelocityGraph2: localVelocityCurve2
        });
    }

    // create texture and render target for rendering into, including depth buffer
    const texture = new pc.Texture(app.graphicsDevice, {
        width: 512,
        height: 256,
        format: pc.PIXELFORMAT_RGB8,
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
    const renderTarget = new pc.RenderTarget({
        name: `RT`,
        colorBuffer: texture,
        depth: true,
        flipY: !app.graphicsDevice.isWebGPU,
        samples: 2
    });

    // create a layer for object that do not render into texture, add it right after the world layer
    const excludedLayer = new pc.Layer({ name: 'Excluded' });
    app.scene.layers.insert(excludedLayer, 1);

    // get existing layers
    const worldLayer = app.scene.layers.getLayerByName('World');
    const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
    const uiLayer = app.scene.layers.getLayerByName('UI');

    // create ground plane and 3 primitives, visible in world layer
    const plane = createPrimitive('plane', new pc.Vec3(0, 0, 0), new pc.Vec3(20, 20, 20), new pc.Color(3, 4, 2), [
        worldLayer.id
    ]);
    /** @type {pc.StandardMaterial} */
    const planeMaterial = plane.render.meshInstances[0].material;

    // make the texture tiles and use anisotropic filtering to prevent blurring
    planeMaterial.diffuseMap = assets.checkerboard.resource;
    planeMaterial.diffuseMapTiling.set(10, 10);
    planeMaterial.anisotropy = 16;

    createPrimitive('sphere', new pc.Vec3(-2, 1, 0), new pc.Vec3(2, 2, 2), pc.Color.RED, [worldLayer.id]);
    createPrimitive('cone', new pc.Vec3(0, 1, -2), new pc.Vec3(2, 2, 2), pc.Color.CYAN, [worldLayer.id]);
    createPrimitive('box', new pc.Vec3(2, 1, 0), new pc.Vec3(2, 2, 2), pc.Color.YELLOW, [worldLayer.id]);

    // particle system
    createParticleSystem(new pc.Vec3(2, 3, 0));

    // Create main camera, which renders entities in world, excluded and skybox layers
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
        fov: 100,
        layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id, uiLayer.id]
    });
    camera.translate(0, 9, 15);
    camera.lookAt(1, 4, 0);
    app.root.addChild(camera);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: plane,
            distanceMax: 20,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');

    // Create texture camera, which renders entities in world and skybox layers into the texture
    const textureCamera = new pc.Entity('TextureCamera');
    textureCamera.addComponent('camera', {
        layers: [worldLayer.id, skyboxLayer.id],

        // set the priority of textureCamera to lower number than the priority of the main camera (which is at default 0)
        // to make it rendered first each frame
        priority: -1,

        // this camera renders into texture target
        renderTarget: renderTarget
    });

    // add sphere at the position of this camera to see it in the world
    textureCamera.addComponent('render', {
        type: 'sphere'
    });
    app.root.addChild(textureCamera);

    // Create an Entity with a omni light component and add it to world layer (and so used by both cameras)
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'omni',
        color: pc.Color.WHITE,
        range: 200,
        castShadows: true,
        layers: [worldLayer.id]
    });
    light.translate(0, 2, 5);
    app.root.addChild(light);

    // create a plane called tv which we use to display rendered texture
    // this is only added to excluded Layer, so it does not render into texture
    const tv = createPrimitive('plane', new pc.Vec3(6, 8, -5), new pc.Vec3(20, 10, 10), pc.Color.BLACK, [
        excludedLayer.id
    ]);
    tv.setLocalEulerAngles(90, 0, 0);
    tv.render.castShadows = false;
    tv.render.receiveShadows = false;
    /** @type {pc.StandardMaterial} */
    const material = tv.render.material;
    material.emissiveMap = texture; // assign the rendered texture as an emissive texture
    material.update();

    // setup skydome, use top mipmap level of cubemap (full resolution)
    app.scene.skyboxMip = 0;
    app.scene.envAtlas = assets.helipad.resource;

    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // update things each frame
    let time = 0;
    let switchTime = 0;
    app.on('update', function (dt) {
        // rotate texture camera around the objects
        time += dt;
        textureCamera.setLocalPosition(12 * Math.sin(time), 3, 12 * Math.cos(time));
        textureCamera.lookAt(pc.Vec3.ZERO);

        // every 5 seconds switch texture camera between perspective and orthographic projection
        switchTime += dt;
        if (switchTime > 5) {
            switchTime = 0;
            if (textureCamera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC) {
                textureCamera.camera.projection = pc.PROJECTION_PERSPECTIVE;
            } else {
                textureCamera.camera.projection = pc.PROJECTION_ORTHOGRAPHIC;
                textureCamera.camera.orthoHeight = 5;
            }
        }

        // debug draw the texture on the screen in the excludedLayer layer of the main camera
        // @ts-ignore engine-tsd
        app.drawTexture(0.7, -0.7, 0.5, 0.5, texture, null, excludedLayer);
    });
});

export { app };
