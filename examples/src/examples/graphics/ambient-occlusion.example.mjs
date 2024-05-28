import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: rootPath + '/static/lib/draco/draco.wasm.js',
    wasmUrl: rootPath + '/static/lib/draco/draco.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/draco/draco.js'
});

const assets = {
    laboratory: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/laboratory.glb' }),
    orbit: new pc.Asset('orbit', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    ssao: new pc.Asset('ssao', 'script', { url: rootPath + '/static/scripts/posteffects/posteffect-ssao.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
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
    pc.ScriptHandler,
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.FontHandler
];

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

    // setup skydome
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxMip = 2;
    app.scene.exposure = 1.5;

    // get the instance of the laboratory
    const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    });
    laboratoryEntity.setLocalScale(100, 100, 100);
    app.root.addChild(laboratoryEntity);

    // set up materials
    laboratoryEntity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((meshInstance) => {

            // disable blending / enable depth writes
            meshInstance.material.depthState = pc.DepthState.DEFAULT;
            meshInstance.material.blendType = pc.BLEND_NONE;

            // disable baked AO map as we want to use SSAO only
            meshInstance.material.aoMap = null;
            meshInstance.material.update();
        });
    });

    // add lights to the torches
    const torches = laboratoryEntity.find(node => node.name.indexOf('Fackel') !== -1);
    torches.forEach((torch) => {
        const light = new pc.Entity('Omni');
        light.addComponent('light', {
            type: 'omni',
            color: new pc.Color(1, 0.75, 0),
            intensity: 3,
            range: 100,
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.2,
            shadowUpdateMode: pc.SHADOWUPDATE_THISFRAME
        });
        light.setLocalPosition(torch.children[0].render.meshInstances[0].aabb.center);
        app.root.addChild(light);
    });

    // add a ground plane
    const planeMaterial = new pc.StandardMaterial();
    planeMaterial.diffuse = new pc.Color(0.2, 0.2, 0.2);
    planeMaterial.update();

    const primitive = new pc.Entity();
    primitive.addComponent('render', {
        type: 'plane',
        material: planeMaterial
    });
    primitive.setLocalScale(new pc.Vec3(400, 1, 400));
    primitive.setLocalPosition(0, -40, 0);
    app.root.addChild(primitive);

    // Create a directional light
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        intensity: 0.7,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.06,
        shadowDistance: 600,
        shadowUpdateMode: pc.SHADOWUPDATE_THISFRAME
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(35, 30, 0);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5),
        nearClip: 1,
        farClip: 500
    });

    // add orbit camera script
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: laboratoryEntity,
            distanceMax: 350
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');

    // add SSAO post-effect
    data.set('scripts', {
        ssao: {
            enabled: true,
            radius: 5,
            samples: 16,
            brightness: 0,
            downscale: 1
        }
    });

    // position the camera in the world
    camera.setLocalPosition(-60, 30, 60);
    app.root.addChild(camera);

    // handle UI values updates
    Object.keys(data.get('scripts')).forEach((key) => {
        camera.script.create(key, {
            attributes: data.get(`scripts.${key}`)
        });
    });

    data.on('*:set', (/** @type {string} */ path, value) => {
        const pathArray = path.split('.');
        camera.script[pathArray[1]][pathArray[2]] = value;
    });
});

export { app };
