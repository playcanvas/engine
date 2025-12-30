// @config HIDDEN
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
    other: new pc.Asset('other', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-height.jpg` }),
    gloss: new pc.Asset('other', 'texture', { url: `${rootPath}/static/assets/textures/seaside-rocks01-gloss.jpg` }),
    colors: new pc.Asset('other', 'texture', { url: `${rootPath}/static/assets/textures/colors.webp` }),
    hatch: new pc.Asset('other', 'texture', { url: `${rootPath}/static/assets/textures/hatch-0.jpg` })
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
        color: new pc.Color(1, 0.8, 0.25),
        intensity: 2
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(85, -100, 0);

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

    // red pill it the sheen material
    const materialSheen = new pc.StandardMaterial();
    materialSheen.diffuse = new pc.Color(0.9, 0.6, 0.6);
    materialSheen.useMetalness = true;   // sheen requires metalness workflow
    materialSheen.metalness = 0.5;

    materialSheen.useSheen = true;
    materialSheen.sheenMap = assets.other.resource;
    materialSheen.sheen = new pc.Color(0.9, 0.2, 0.1);
    materialSheen.sheenGlossMap = assets.diffuse.resource;
    materialSheen.sheenGloss = 0.7;
    materialSheen.update();

    // green pill - specular & specularity factor
    const materialSpecFactor = new pc.StandardMaterial();
    materialSpecFactor.diffuse = new pc.Color(0.6, 0.9, 0.6);
    materialSpecFactor.gloss = 0.6;
    materialSpecFactor.useMetalness = true;
    materialSpecFactor.metalness = 0.8;
    materialSpecFactor.metalnessMap = assets.other.resource;

    materialSpecFactor.useMetalnessSpecularColor = true;
    materialSpecFactor.specularityFactor = 0.5;
    materialSpecFactor.specularityFactorTint = true;
    materialSpecFactor.specularityFactorMap = assets.diffuse.resource;

    materialSpecFactor.specularMap = assets.colors.resource;
    materialSpecFactor.glossMap = assets.gloss.resource;
    materialSpecFactor.update();

    // blue pill - AO
    const materialAO = new pc.StandardMaterial();
    materialAO.diffuse = new pc.Color(0.6, 0.6, 0.9);
    materialAO.aoMap = assets.gloss.resource;
    materialAO.aoDetailMap = assets.hatch.resource;
    materialAO.update();

    createObject(-1, 0, 0, materialSheen, 0.7);
    createObject(1, 0, 0, materialSpecFactor, 0.7);
    createObject(0, 0, 1, materialAO, 0.7);

    // update things each frame
    let time = 0;
    app.on('update', (dt) => {
        // rotate camera around the objects
        time += dt;
        camera.setLocalPosition(4 * Math.sin(time * 0.5), 0, 4 * Math.cos(time * 0.5));
        camera.lookAt(pc.Vec3.ZERO);
    });
});

export { app };
