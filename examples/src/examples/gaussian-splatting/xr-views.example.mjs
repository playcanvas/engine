// @config
//
// Simulates stereo XR rendering of Gaussian Splats with two side-by-side viewports for left and right
// eyes.
//
// @flag HIDDEN

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

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

const assets = {
    hotel: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/hotel-culpture.compressed.ply' }),
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Create hotel gsplat
    const hotel = new pc.Entity('hotel');
    hotel.addComponent('gsplat', {
        asset: assets.hotel
    });
    hotel.setLocalEulerAngles(180, 0, 0);
    app.root.addChild(hotel);

    // Create camera with orbit controls
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: pc.Color.BLACK,
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
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
    data.set('exaggeratedStereo', false);

    // Interpupillary distance (~63mm), half for each eye offset from center
    const halfIPD = 0.032;

    // Set up two RenderViews for stereo rendering (left eye, right eye)
    const viewsList = [new pc.RenderView(), new pc.RenderView()];

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
    const projMat = new pc.Mat4();
    const viewInvMat = new pc.Mat4();

    app.on('update', (/** @type {number} */ dt) => {

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
            const right = new pc.Vec3();
            rot.transformVector(pc.Vec3.RIGHT, right);
            const eyePos = new pc.Vec3().add2(pos, right.mulScalar(eyeSign * offset));

            const focusPoint = hotel.getPosition();
            viewInvMat.setLookAt(eyePos, focusPoint, pc.Vec3.UP);

            // supply the eye's projection and pose; the view matrix is derived from viewInvMat
            view.setView(projMat.data, viewInvMat.data);

            // side-by-side viewports: left eye on left half, right eye on right half
            view.setViewport(viewIndex * (width / 2), 0, width / 2, height);
        });
    });
});
