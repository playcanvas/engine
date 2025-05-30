// @config E2E_TEST
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';
const { ShadowCatcher } = await fileImport(`${rootPath}/static/scripts/esm/shadow-catcher.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    statue: new pc.Asset('statue', 'container', { url: `${rootPath}/static/assets/models/statue.glb` }),
    hdri_street: new pc.Asset(
        'hdri',
        'texture',
        { url: `${rootPath}/static/assets/hdri/st-peters-square.hdr` },
        { mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`,

    // enable HDR rendering if supported
    displayFormat: pc.DISPLAYFORMAT_HDR
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.ScriptComponentSystem, pc.LightComponentSystem];
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

    // add an instance of the statue
    const statueEntity = assets.statue.resource.instantiateRenderEntity({
        castShadows: true
    });
    statueEntity.rotate(0, 140, 0);
    app.root.addChild(statueEntity);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        farClip: 500,
        fov: 60,

        // if the device renders in HDR mode, disable tone mapping to output HDR values without any processing
        toneMapping: device.isHdr ? pc.TONEMAP_NONE : pc.TONEMAP_ACES,
        gammaCorrection: pc.GAMMA_SRGB
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
    cameraEntity.setLocalPosition(35, 12, -17);
    cameraEntity.lookAt(0, 0, 1);
    app.root.addChild(cameraEntity);

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

    applyHdri(assets.hdri_street.resource);
    app.scene.sky.type = pc.SKYTYPE_DOME;
    app.scene.sky.node.setLocalScale(new pc.Vec3(200, 200, 200));
    app.scene.sky.node.setLocalPosition(pc.Vec3.ZERO);
    app.scene.sky.center = new pc.Vec3(0, 0.05, 0);
    app.scene.exposure = 0.4;

    // create two directional lights which cast shadows
    const light1 = new pc.Entity('Light1');
    light1.addComponent('light', {
        type: 'directional',
        color: pc.Color.YELLOW,
        castShadows: true,
        shadowBias: 0.1,
        normalOffsetBias: 0.3,
        shadowDistance: 50,
        shadowResolution: 1024,
        shadowIntensity: 0.2,
        shadowType: pc.SHADOW_PCSS_32F,
        penumbraSize: 10,
        penumbraFalloff: 4,
        shadowSamples: 10,
        shadowBlockerSamples: 10
    });
    light1.setLocalEulerAngles(55, -90, 0);
    app.root.addChild(light1);

    const light2 = new pc.Entity('Light2');
    light2.addComponent('light', {
        type: 'directional',
        color: pc.Color.RED,
        castShadows: true,
        shadowBias: 0.1,
        normalOffsetBias: 0.3,
        shadowDistance: 50,
        shadowResolution: 1024,
        shadowIntensity: 0.3
    });
    light2.setLocalEulerAngles(45, -30, 0);
    app.root.addChild(light2);

    // Create an entity with a shadow catcher script, and create a shadow catcher geometry plane
    // with a specified scale
    const shadowCatcher = new pc.Entity('ShadowCatcher');
    shadowCatcher.addComponent('script').create(ShadowCatcher, {
        properties: {
            scale: new pc.Vec3(50, 50, 50)
        }
    });
    app.root.addChild(shadowCatcher);

    // set initial values
    data.set('data', {
        affectScene: false,
        catcher: true,
        rotate: false
    });

    app.on('update', (dt) => {

        // enable the shadow catcher
        shadowCatcher.enabled = data.get('data.catcher');

        // rotate the light
        if (data.get('data.rotate')) {
            light1.rotate(0, 20 * dt, 0);
            light2.rotate(0, -30 * dt, 0);
        }

        // if lights should not affect the scene, set their intensity to 0
        const affectScene = data.get('data.affectScene');
        light1.light.intensity = affectScene ? 1 : 0;
        light2.light.intensity = affectScene ? 1 : 0;
    });
});

export { app };
