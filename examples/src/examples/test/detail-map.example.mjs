// @config HIDDEN
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    fly: new pc.Asset('fly', 'script', { url: `${rootPath}/static/scripts/camera/fly-camera.js` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/morning-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    diffuse: new pc.Asset('diffuse', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-color.jpg` }),
    diffuseDetail: new pc.Asset('diffuse', 'texture', { url: `${rootPath}/static/assets/textures/playcanvas.png` }),
    normal: new pc.Asset('normal', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-normal.jpg` }),
    normalDetail: new pc.Asset('normal', 'texture', { url: `${rootPath}/static/assets/textures/normal-map.png` }),
    ao: new pc.Asset('ao', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-ao.jpg` }),
    aoDetail: new pc.Asset('ao', 'texture', { url: `${rootPath}/static/assets/textures/playcanvas-grey.png` })
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
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.ScriptComponentSystem];
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

    app.scene.envAtlas = assets.helipad.resource;
    app.scene.exposure = 3;

    // Create an entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_ACES,
        fov: 75
    });
    camera.translate(0, 0, 3);
    app.root.addChild(camera);

    // add fly camera script
    camera.addComponent('script');
    camera.script.create('flyCamera', {
        attributes: {
            speed: 100
        }
    });

    // Create an entity with an omni light component
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1, 1, 1),
        intensity: 2,
        castShadows: false,
        range: 800
    });
    light.addComponent('render', {
        type: 'sphere'
    });
    light.setLocalScale(30, 30, 30);
    light.setLocalPosition(200, -100, 0);
    app.root.addChild(light);

    // material with detail maps
    const tiling = 3;
    const material = new pc.StandardMaterial();
    material.diffuseMap = assets.diffuse.resource;
    material.diffuseDetailMode = pc.DETAILMODE_MUL;
    material.normalMap = assets.normal.resource;
    material.aoMap = assets.ao.resource;
    material.gloss = 0.3;
    material.useMetalness = true;
    material.diffuseMapTiling.set(tiling, tiling);
    material.normalMapTiling.set(tiling, tiling);
    material.heightMapTiling.set(tiling, tiling);
    material.update();

    /**
     * Helper function to create a 3d primitive including its material.
     *
     * @param {string} primitiveType - The primitive type.
     * @param {pc.Vec3} position - The position.
     * @param {pc.Vec3} scale - The scale.
     * @param {pc.Material} material - The material.
     */
    function createPrimitive(primitiveType, position, scale, material) {
        // create the primitive using the material
        const primitive = new pc.Entity();
        primitive.addComponent('render', {
            type: primitiveType,
            material: material,
            castShadows: false,
            receiveShadows: false
        });

        // set position and scale and add it to scene
        primitive.setLocalPosition(position);
        primitive.setLocalScale(scale);
        app.root.addChild(primitive);
    }

    // create the ground plane from the boxes
    createPrimitive('box', new pc.Vec3(0, -200, 0), new pc.Vec3(800, 2, 800), material);
    createPrimitive('box', new pc.Vec3(0, 200, 0), new pc.Vec3(800, 2, 800), material);

    // walls
    createPrimitive('box', new pc.Vec3(400, 0, 0), new pc.Vec3(2, 400, 800), material);
    createPrimitive('box', new pc.Vec3(-400, 0, 0), new pc.Vec3(2, 400, 800), material);
    createPrimitive('box', new pc.Vec3(0, 0, -400), new pc.Vec3(800, 400, 0), material);
    createPrimitive('box', new pc.Vec3(0, 0, 400), new pc.Vec3(800, 400, 0), material);

    // initial values
    data.set('data', {
        diffuse: true,
        normal: true,
        ao: true
    });

    // update things each frame
    app.on('update', (dt) => {

        // toggle diffuse detail map
        const diffuseEnabled = !!material.diffuseDetailMap;
        if (diffuseEnabled !== data.get('data.diffuse')) {
            material.diffuseDetailMap = diffuseEnabled ? null : assets.diffuseDetail.resource;
            material.update();
        }

        // toggle normal detail map
        const normalEnabled = !!material.normalDetailMap;
        if (normalEnabled !== data.get('data.normal')) {
            material.normalDetailMap = normalEnabled ? null : assets.normalDetail.resource;
            material.update();
        }

        // toggle ao detail map
        const aoEnabled = !!material.aoDetailMap;
        if (aoEnabled !== data.get('data.ao')) {
            material.aoDetailMap = aoEnabled ? null : assets.aoDetail.resource;
            material.update();
        }
    });
});

export { app };
