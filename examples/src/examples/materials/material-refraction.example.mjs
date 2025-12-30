import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    normal: new pc.Asset('normal', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-normal.jpg` }),
    diffuse: new pc.Asset('diffuse', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-color.jpg` }),
    other: new pc.Asset('other', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-gloss.jpg` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.envAtlas = assets.helipad.resource;

    // Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
    // Move the depth layer to take place after World and Skydome layers, to capture both of them.
    const depthLayer = app.scene.layers.getLayerById(pc.LAYERID_DEPTH);
    app.scene.layers.remove(depthLayer);
    app.scene.layers.insertOpaque(depthLayer, 2);

    // Create an entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES
    });
    app.root.addChild(camera);

    // Create an entity with a directional light component
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 0.8, 0.25)
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(85, -100, 0);

    // ground
    const groundMaterial = new pc.StandardMaterial();
    groundMaterial.diffuse = new pc.Color(1, 2.5, 2.5);
    groundMaterial.diffuseMap = assets.diffuse.resource;
    groundMaterial.gloss = 0.4;
    groundMaterial.metalness = 0.5;
    groundMaterial.useMetalness = true;
    groundMaterial.update();

    const ground = new pc.Entity();
    ground.addComponent('render', {
        type: 'box',
        material: groundMaterial
    });
    ground.setLocalScale(30, 1, 30);
    ground.setLocalPosition(0, -2, 0);
    app.root.addChild(ground);

    const createObject = function (x, y, z, material, scale) {
        const obj = new pc.Entity();
        obj.addComponent('render', {
            material: material,
            type: 'capsule'
        });
        obj.setLocalPosition(x, y, z);
        obj.setLocalScale(scale, scale, scale);
        app.root.addChild(obj);
    };

    // basic refractive material
    const material = new pc.StandardMaterial();
    material.metalness = 0.0;       // low metalness, otherwise it's reflective
    material.gloss = 1.0;
    material.glossMap = assets.other.resource;
    material.glossMapChannel = 'g';
    material.useMetalness = true; // refractive materials are currently supported only with metalness
    material.refraction = 0.8;
    material.refractionIndex = 1.0;
    material.blendType = pc.BLEND_NORMAL;
    material.thickness = 0.4;
    material.thicknessMap = assets.other.resource;
    material.update();

    // clone and apply additional settings for the second material
    const material2 = material.clone();
    material2.diffuse = new pc.Color(0.9, 0.6, 0.6);
    material2.normalMap = assets.normal.resource;
    material2.bumpiness = 2.0;
    material2.refractionMap = assets.diffuse.resource;
    material2.update();

    // two main objects with refraction materials
    createObject(-0.5, 0, 0, material, 0.7);
    createObject(0.5, 0, 0, material2, 0.7);

    // create a ring of objects with a simple color material as a background
    const objMaterial = new pc.StandardMaterial();
    objMaterial.diffuse = new pc.Color(0.5, 0.5, 2.5);
    objMaterial.gloss = 0.5;
    objMaterial.metalness = 0.5;
    objMaterial.useMetalness = true;
    objMaterial.update();
    const count = 8;
    for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        createObject(Math.cos(angle) * 2.5, -0.3, Math.sin(angle) * 2.5, objMaterial, 0.2);
    }

    // initial values for the UI
    data.set('data', {
        dynamic: false
    });

    // update things each frame
    let time = 0;
    app.on('update', (dt) => {
        // rotate camera around the objects
        time += dt;
        camera.setLocalPosition(3 * Math.sin(time * 0.5), 0, 3 * Math.cos(time * 0.5));
        camera.lookAt(pc.Vec3.ZERO);

        // handle dynamic refraction toggle
        const dynamic = data.get('data.dynamic');
        if (material.useDynamicRefraction !== dynamic) {
            material.useDynamicRefraction = dynamic;
            material.update();
            material2.useDynamicRefraction = dynamic;
            material2.update();

            // when dynamic is enabled, the camera needs to render the scene's color map
            camera.camera.requestSceneColorMap(dynamic);
        }
    });
});

export { app };
