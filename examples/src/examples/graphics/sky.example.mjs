import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    statue: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/statue.glb' }),
    hdri_street: new pc.Asset(
        'hdri',
        'texture',
        { url: rootPath + '/static/assets/hdri/wide-street.hdr' },
        { mipmaps: false }
    ),
    hdri_room: new pc.Asset(
        'hdri',
        'texture',
        { url: rootPath + '/static/assets/hdri/empty-room.hdr' },
        { mipmaps: false }
    )
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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.ScriptComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

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

    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // add an instance of the statue
    const statueEntity = assets.statue.resource.instantiateRenderEntity();
    app.root.addChild(statueEntity);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        farClip: 500,
        fov: 60
    });

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: statueEntity,
            distanceMax: 500,
            frameOnStart: false
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    // position the camera in the world
    cameraEntity.setLocalPosition(-4, 5, 22);
    cameraEntity.lookAt(0, 0, 1);
    app.root.addChild(cameraEntity);

    // skydome presets
    const presetStreetDome = {
        skybox: {
            preset: 'Street Dome',
            type: pc.SKYTYPE_DOME,
            scale: [200, 200, 200],
            position: [0, 0, 0],
            tripodY: 0.05,
            exposure: 0.7,
            rotation: 0
        }
    };

    const presetStreetInfinite = {
        skybox: {
            preset: 'Street Infinite',
            type: pc.SKYTYPE_INFINITE,
            scale: [1, 1, 1],
            position: [0, 0, 0],
            tripodY: 0,
            exposure: 0.7,
            rotation: 0
        }
    };

    const presetRoom = {
        skybox: {
            preset: 'Room',
            type: pc.SKYTYPE_BOX,
            scale: [44, 24, 28],
            position: [0, 0, 0],
            tripodY: 0.6,
            exposure: 0.7,
            rotation: 50
        }
    };

    // apply hdri texture
    const applyHdri = (source) => {
        // convert it to high resolution cubemap for the skybox
        // this is optional in case you want a really high resolution skybox
        const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
        app.scene.skybox = skybox;

        // generate env-atlas texture for the lighting
        // this would also be used as low resolution skybox if high resolution is not available
        const lighting = pc.EnvLighting.generateLightingSource(source);
        const envAtlas = pc.EnvLighting.generateAtlas(lighting);
        lighting.destroy();
        app.scene.envAtlas = envAtlas;
    };

    // when UI value changes, update skybox data
    data.on('*:set', (/** @type {string} */ path, value) => {
        const pathArray = path.split('.');

        if (pathArray[2] === 'preset' && pathArray.length === 3) {
            // apply preset
            if (data.get('data.skybox.preset') === value) {
                // apply preset data
                data.set(
                    'data',
                    value === 'Room' ? presetRoom : value === 'Street Dome' ? presetStreetDome : presetStreetInfinite
                );

                // update hdri texture
                applyHdri(value === 'Room' ? assets.hdri_room.resource : assets.hdri_street.resource);
            }
        } else {
            // apply individual settings
            app.scene.sky.type = data.get('data.skybox.type');
            app.scene.sky.node.setLocalScale(new pc.Vec3(data.get('data.skybox.scale') ?? [1, 1, 1]));
            app.scene.sky.node.setLocalPosition(new pc.Vec3(data.get('data.skybox.position') ?? [0, 0, 0]));
            app.scene.sky.center = new pc.Vec3(0, data.get('data.skybox.tripodY') ?? 0, 0);
            app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, data.get('data.skybox.rotation'), 0);
            app.scene.exposure = data.get('data.skybox.exposure');
        }
    });

    // apply initial preset
    data.set('data.skybox.preset', 'Street Dome');
});

export { app };
