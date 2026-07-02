// @config
//
// Simulates stereo XR rendering of Gaussian Splats with two side-by-side viewports for left and right
// eyes.
//
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    Mat4,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderView,
    ScriptComponentSystem,
    ScriptHandler,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

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

const assets = {
    hotel: new Asset('gsplat', 'gsplat', { url: './assets/splats/hotel-culpture.compressed.ply' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Create hotel gsplat
const hotel = new Entity('hotel');
hotel.addComponent('gsplat', {
    asset: assets.hotel
});
hotel.setLocalEulerAngles(180, 0, 0);
app.root.addChild(hotel);

// Create camera with orbit controls
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: Color.BLACK,
    fov: 80
});
camera.setLocalPosition(3, 1, 0.5);

camera.addComponent('script');
camera.script?.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: hotel,
        distanceMax: 2,
        frameOnStart: false
    }
});
camera.script?.create('orbitCameraInputMouse');
camera.script?.create('orbitCameraInputTouch');
app.root.addChild(camera);

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', GSPLAT_RENDERER_AUTO);
data.set('exaggeratedStereo', false);

// Interpupillary distance (~63mm), half for each eye offset from center
const halfIPD = 0.032;

// Set up two RenderViews for stereo rendering (left eye, right eye)
const viewsList = [new RenderView(), new RenderView()];

const cameraComponent = camera.camera;

// simulate an active XR session by handing the camera the per-view array directly. On a real
// headset the XrManager populates xrViews (and the per-eye device projection); here we build
// each eye's projection from the camera's settings, captured before the session is activated
// (once active, the fov/clip getters report XR-session values instead).
const projFov = cameraComponent.fov;
const projNearClip = cameraComponent.nearClip;
const projFarClip = cameraComponent.farClip;
const projHorizontalFov = cameraComponent.horizontalFov;
cameraComponent.camera.xrViews = viewsList;

// reused each frame; setView/setViewport copy the data into each view
const projMat = new Mat4();
const viewInvMat = new Mat4();

app.on('update', (/** @type {number} */ _dt) => {
    const width = canvas.width;
    const height = canvas.height;

    // both eyes share the projection; the renderer derives the per-view matrices from setView
    projMat.setPerspective(projFov, width / height, projNearClip, projFarClip, projHorizontalFov);

    viewsList.forEach((view, viewIndex) => {
        const pos = camera.getPosition();
        const rot = camera.getRotation();

        // offset each eye along the camera's right vector, converging on the orbit target
        const eyeSign = viewIndex === 0 ? -1 : 1;
        const offset = data.get('exaggeratedStereo') ? 0.5 : halfIPD;
        const right = new Vec3();
        rot.transformVector(Vec3.RIGHT, right);
        const eyePos = new Vec3().add2(pos, right.mulScalar(eyeSign * offset));

        const focusPoint = hotel.getPosition();
        viewInvMat.setLookAt(eyePos, focusPoint, Vec3.UP);

        // supply the eye's projection and pose; the view matrix is derived from viewInvMat
        view.setView(projMat.data, viewInvMat.data);

        // side-by-side viewports: left eye on left half, right eye on right half
        view.setViewport(viewIndex * (width / 2), 0, width / 2, height);
    });
});
