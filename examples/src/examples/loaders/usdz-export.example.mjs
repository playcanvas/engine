import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// add AR button to download the usdz file
const appInner = /** @type {HTMLElement} */ (document.getElementById('appInner'));
const div = document.createElement('div');
div.style.cssText = 'width:100%; position:absolute; top:10px';
div.innerHTML = `<div style="text-align: center;">
    <a id="ar-link" rel="ar" download="bench.usdz">
        <img src="${rootPath}/static/assets/textures/transparent.png" id="button" width="200"/>
    </a>    
</div>`;
appInner.appendChild(div);

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    bench: new pc.Asset('bench', 'container', { url: rootPath + '/static/assets/models/bench_wooden_01.glb' })
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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

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

    // get the instance of the bench and set up with render component
    const entity = assets.bench.resource.instantiateRenderEntity();
    app.root.addChild(entity);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.1, 0.1),
        farClip: 100
    });
    camera.translate(-3, 1, 2);
    camera.lookAt(0, 0.5, 0);
    app.root.addChild(camera);

    // set skybox
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxMip = 1;

    // a link element, created in the html part of the examples.
    const link = document.getElementById('ar-link');

    // convert the loaded entity into asdz file
    const options = {
        maxTextureSize: 1024
    };

    new pc.UsdzExporter()
        .build(entity, options)
        .then((arrayBuffer) => {
            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
            // On iPhone Safari, this link creates a clickable AR link on the screen. When this is clicked,
            // the download of the .asdz file triggers its opening in QuickLook AT mode.
            // In other browsers, this simply downloads the generated .asdz file.

            // @ts-ignore
            link.href = URL.createObjectURL(blob);
        })
        .catch(console.error);

    // when clicking on the download UI button, trigger the download
    data.on('download', function () {
        link.click();
    });

    // spin the meshe
    app.on('update', function (dt) {
        if (entity) {
            entity.rotate(0, -12 * dt, 0);
        }
    });
});

export { app };
