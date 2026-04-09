// @config HIDDEN
// @config DESCRIPTION Simulates stereo XR rendering of Gaussian Splats with two side-by-side viewports for left and right eyes.
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

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
    hotel: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/hotel-culpture.compressed.ply` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Create hotel gsplat
    const hotel = new pc.Entity('hotel');
    hotel.addComponent('gsplat', {
        asset: assets.hotel,
        unified: true
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

    // Set up two XR views for stereo rendering (left eye, right eye)
    const viewsList = [];
    for (let i = 0; i < 2; i++) {
        viewsList.push({
            updateTransforms(transform) {
            },
            viewport: new pc.Vec4(),
            projMat: new pc.Mat4(),
            viewOffMat: new pc.Mat4(),
            viewInvOffMat: new pc.Mat4(),
            viewMat3: new pc.Mat3(),
            projViewOffMat: new pc.Mat4(),
            viewInvMat: new pc.Mat4(),
            positionData: [0, 0, 0],
            viewIndex: i
        });
    }

    camera.camera.camera.xr = {
        session: true,
        views: {
            list: viewsList
        }
    };

    const cameraComponent = camera.camera;
    app.on('update', (/** @type {number} */ dt) => {

        const width = canvas.width;
        const height = canvas.height;

        viewsList.forEach((/** @type {XrView} */ view) => {
            view.projMat.copy(cameraComponent.projectionMatrix);

            const pos = camera.getPosition();
            const rot = camera.getRotation();

            // offset each eye along the camera's right vector, converging on the orbit target
            const eyeSign = view.viewIndex === 0 ? -1 : 1;
            const offset = data.get('exaggeratedStereo') ? 0.5 : halfIPD;
            const right = new pc.Vec3();
            rot.transformVector(pc.Vec3.RIGHT, right);
            const eyePos = new pc.Vec3().add2(pos, right.mulScalar(eyeSign * offset));

            const focusPoint = hotel.getPosition();
            const viewInvMat = new pc.Mat4().setLookAt(eyePos, focusPoint, pc.Vec3.UP);
            const viewMat = new pc.Mat4().copy(viewInvMat).invert();

            view.viewOffMat.copy(viewMat);
            view.viewInvOffMat.copy(viewInvMat);
            view.viewMat3.setFromMat4(viewMat);
            view.projViewOffMat.mul2(view.projMat, viewMat);
            view.positionData[0] = eyePos.x;
            view.positionData[1] = eyePos.y;
            view.positionData[2] = eyePos.z;

            // side-by-side viewports: left eye on left half, right eye on right half
            const viewport = view.viewport;
            viewport.x = view.viewIndex * (width / 2);
            viewport.y = 0;
            viewport.z = width / 2;
            viewport.w = height;
        });
    });
});

export { app };
