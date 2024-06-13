import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

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

const assets = {
    tv: new pc.Asset('tv', 'container', { url: rootPath + '/static/assets/models/tv.glb' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });
    camera.translate(0, 0, 15);

    // Create an Entity with a omni light
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1, 1, 1),
        range: 30
    });
    light.translate(5, 5, 10);

    app.root.addChild(camera);
    app.root.addChild(light);

    // Create a texture to hold the video frame data
    const videoTexture = new pc.Texture(app.graphicsDevice, {
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    // Create our HTML element with the video
    /** @type {HTMLVideoElement} */
    const video = document.createElement('video');
    video.id = 'vid';
    video.loop = true;

    // Muted so that we can autoplay
    video.muted = true;
    video.autoplay = true;

    // Inline needed for iOS otherwise it plays at fullscreen
    video.playsInline = true;

    video.crossOrigin = 'anonymous';

    // Make sure that the video is in view on the page otherwise it doesn't
    // load on some browsers, especially mobile
    video.setAttribute(
        'style',
        'display: block; width: 1px; height: 1px; position: absolute; opacity: 0; z-index: -1000; top: 0px; pointer-events: none'
    );

    video.src = rootPath + '/static/assets/video/SampleVideo_1280x720_1mb.mp4';
    document.body.append(video);

    video.addEventListener('canplaythrough', function () {
        videoTexture.setSource(video);
    });

    // Listen for the 'loadedmetadata' event to resize the texture appropriately
    video.addEventListener('loadedmetadata', function () {
        videoTexture.resize(video.videoWidth, video.videoHeight);
    });

    // create an entity to render the tv mesh
    const entity = assets.tv.resource.instantiateRenderEntity();
    app.root.addChild(entity);

    // Create a material that will use our video texture
    const material = new pc.StandardMaterial();
    material.useLighting = false;
    material.emissiveMap = videoTexture;
    material.update();

    // set the material on the screen mesh
    entity.render.meshInstances[1].material = material;

    video.load();

    const mouse = new pc.Mouse(document.body);
    mouse.on('mousedown', function (event) {
        if (entity && event.buttons[pc.MOUSEBUTTON_LEFT]) {
            video.muted = !video.muted;
        }
    });

    let upload = false;
    let time = 0;
    app.on('update', function (dt) {
        time += dt;

        // rotate the tv object
        entity.setLocalEulerAngles(100 + Math.sin(time) * 50, 0, -90);

        // Upload the video data to the texture every other frame
        upload = !upload;
        if (upload) {
            videoTexture.upload();
        }
    });
});

export { app };
