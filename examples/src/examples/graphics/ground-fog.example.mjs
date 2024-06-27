import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    terrain: new pc.Asset('terrain', 'container', { url: rootPath + '/static/assets/models/terrain.glb' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    texture: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/clouds.jpg' })
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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
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

    data.set('data', {
        softness: true
    });

    // setup skydome
    app.scene.skyboxMip = 3;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -70, 0);
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // disable skydome rendering
    const skyLayer = app.scene.layers.getLayerById(pc.LAYERID_SKYBOX);
    skyLayer.enabled = false;

    // instantiate the terrain
    const terrain = assets.terrain.resource.instantiateRenderEntity();
    terrain.setLocalScale(30, 30, 30);
    app.root.addChild(terrain);

    // find a tree in the middle to use as a focus point
    const tree = terrain.findOne('name', 'Arbol 2.002');

    // create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(150 / 255, 213 / 255, 63 / 255),
        farClip: 1000
    });

    // and position it in the world
    camera.setLocalPosition(-200, 120, 225);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: tree,
            distanceMax: 600
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // enable the camera to render the scene's depth map.
    camera.camera.requestSceneDepthMap(true);

    // Create a directional light casting cascaded shadows
    const dirLight = new pc.Entity();
    dirLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        shadowBias: 0.3,
        normalOffsetBias: 0.2,
        intensity: 1.0,

        // enable shadow casting
        castShadows: true,
        shadowDistance: 1000,
        shadowResolution: 2048,
        shadowType: pc.SHADOW_PCF3
    });
    app.root.addChild(dirLight);
    dirLight.setLocalEulerAngles(45, 350, 20);

    // create a custom fog shader
    // @ts-ignore
    const vertex = `#define VERTEXSHADER\n` + pc.shaderChunks.screenDepthPS + files['shader.vert'];
    // @ts-ignore
    const fragment = pc.shaderChunks.screenDepthPS + files['shader.frag'];
    const shader = pc.createShaderFromCode(app.graphicsDevice, vertex, fragment, 'GroundFogShader');

    // and set up a material using this shader
    const material = new pc.Material();
    material.shader = shader;
    material.setParameter('uTexture', assets.texture.resource);
    material.depthWrite = false;
    material.blendType = pc.BLEND_NORMAL;
    material.update();

    // create a subdivided plane mesh, to allow for vertex animation by the shader
    const mesh = pc.Mesh.fromGeometry(
        app.graphicsDevice,
        new pc.PlaneGeometry({ widthSegments: 20, lengthSegments: 20 })
    );
    const meshInstance = new pc.MeshInstance(mesh, material);
    const ground = new pc.Entity();
    ground.addComponent('render', {
        meshInstances: [meshInstance],
        material: material,
        castShadows: false,
        receiveShadows: false
    });
    ground.setLocalScale(500, 1, 500);
    ground.setLocalPosition(0, 25, 0);
    app.root.addChild(ground);

    let firstFrame = true;
    let currentTime = 0;
    app.on('update', function (dt) {
        // on the first frame, when camera is updated, move it further away from the focus tree
        if (firstFrame) {
            firstFrame = false;
            // @ts-ignore engine-tsd
            camera.script.orbitCamera.distance = 320;
        }

        // Update the time and pass it to shader
        currentTime += dt;
        material.setParameter('uTime', currentTime);

        // based on sofness toggle, set shader parameter
        material.setParameter('uSoftening', data.get('data.softness') ? 50 : 1000);

        // debug rendering of the deptht texture in the corner
        app.drawDepthTexture(0.7, -0.7, 0.5, -0.5);
    });
});

export { app };
