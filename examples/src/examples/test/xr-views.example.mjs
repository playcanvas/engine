// @config HIDDEN
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    terrain: new pc.Asset('terrain', 'container', { url: `${rootPath}/static/assets/models/terrain.glb` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
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
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

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

    // setup skydome
    app.scene.skyboxMip = 3;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -70, 0);

    // instantiate the terrain
    /** @type {pc.Entity} */
    const terrain = assets.terrain.resource.instantiateRenderEntity();
    terrain.setLocalScale(30, 30, 30);
    app.root.addChild(terrain);

    // Create a directional light
    const dirLight = new pc.Entity('Cascaded Light');
    dirLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        shadowBias: 0.3,
        normalOffsetBias: 0.2,
        intensity: 1.0,

        // enable shadow casting
        castShadows: false,
        shadowDistance: 1000
    });
    app.root.addChild(dirLight);
    dirLight.setLocalEulerAngles(75, 120, 20);

    // create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.9, 0.9, 0.9),
        farClip: 1000,
        toneMapping: pc.TONEMAP_ACES
    });

    // and position it in the world
    camera.setLocalPosition(-500, 160, 300);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: terrain,
            distanceMax: 600
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // Create XR views using a loop
    const viewsList = [];
    const numViews = 4; // 2x2 grid

    for (let i = 0; i < numViews; i++) {
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

        // update all views - supply some matrices to make pre view rendering possible
        // note that this is not complete set up, view frustum does not get updated and so
        // culling does not work well
        viewsList.forEach((/** @type {XrView} */ view) => {
            view.projMat.copy(cameraComponent.projectionMatrix);

            const pos = camera.getPosition();
            const rot = camera.getRotation();

            const viewInvMat = new pc.Mat4();

            // Rotate each view by 10 degrees * view index around UP axis
            const angle = 10 * view.viewIndex;
            const upRotation = new pc.Quat().setFromAxisAngle(pc.Vec3.UP, angle);
            const combinedRot = new pc.Quat().mul2(upRotation, rot);
            viewInvMat.setTRS(pos, combinedRot, pc.Vec3.ONE);

            const viewMat = new pc.Mat4();
            viewMat.copy(viewInvMat).invert();

            view.viewMat3.setFromMat4(viewMat);

            view.projViewOffMat.mul2(view.projMat, viewMat);

            // adjust viewport for a 2x2 grid layout
            const viewport = view.viewport;
            viewport.x = (view.viewIndex % 2 === 0) ? 0 : width / 2;
            viewport.y = (view.viewIndex < 2) ? 0 : height / 2;
            viewport.z = width / 2;
            viewport.w = height / 2;
        });
    });
});

export { app };
