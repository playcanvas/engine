// @config
// @flag WEBGL_DISABLED

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BindGroupFormat,
    BindStorageBufferFormat,
    BindUniformBufferFormat,
    CameraComponentSystem,
    Color,
    Compute,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    RENDERSTYLE_SOLID,
    RENDERSTYLE_WIREFRAME,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    ScriptComponentSystem,
    ScriptHandler,
    Shader,
    SphereGeometry,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_UINT,
    UniformBufferFormat,
    UniformFormat,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    color: new Asset('color', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/seaside-rocks01-normal.jpg' }),
    gloss: new Asset('gloss', 'texture', { url: './assets/textures/seaside-rocks01-gloss.jpg' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
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
    ScriptComponentSystem
];

createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 2;
app.scene.envAtlas = assets.helipad.resource;

// sphere material
const material = new StandardMaterial();
material.diffuseMap = assets.color.resource;
material.normalMap = assets.normal.resource;
material.glossMap = assets.gloss.resource;
material.update();

// sphere mesh and entity
const entity = new Entity('Sphere');
app.root.addChild(entity);

const geom = new SphereGeometry({
    radius: 1,
    latitudeBands: 100,
    longitudeBands: 100
});

const mesh = Mesh.fromGeometry(device, geom, {
    storageVertex: true // allow vertex buffer to be accessible by compute shader
});

// Add a render component with the mesh
entity.addComponent('render', {
    meshInstances: [new MeshInstance(mesh, material)]
});
app.root.addChild(entity);

// Create an orbit camera
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});
cameraEntity.translate(0, 0, 5);

// add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: entity
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');
app.root.addChild(cameraEntity);

// a compute shader that will modify the vertex buffer of the mesh every frame
const shader = device.supportsCompute ?
    new Shader(device, {
        name: 'ComputeShader',
        shaderLanguage: SHADERLANGUAGE_WGSL,
        cshader: computeShaderWgsl,

        // format of a uniform buffer used by the compute shader
        computeUniformBufferFormats: {
            ub: new UniformBufferFormat(device, [
                new UniformFormat('count', UNIFORMTYPE_UINT),
                new UniformFormat('positionOffset', UNIFORMTYPE_UINT),
                new UniformFormat('normalOffset', UNIFORMTYPE_UINT),
                new UniformFormat('time', UNIFORMTYPE_FLOAT)
            ])
        },

        // format of a bind group, providing resources for the compute shader
        computeBindGroupFormat: new BindGroupFormat(device, [
            // a uniform buffer we provided format for
            new BindUniformBufferFormat('ub', SHADERSTAGE_COMPUTE),
            // the vertex buffer we want to modify
            new BindStorageBufferFormat('vb', SHADERSTAGE_COMPUTE)
        ])
    }) :
    null;

// information about the vertex buffer format - offset of position and normal attributes
// Note: data is stored non-interleaved, positions together, normals together, so no need
// to worry about stride
const format = mesh.vertexBuffer.format;
const positionElement = format.elements.find(e => e.name === SEMANTIC_POSITION);
const normalElement = format.elements.find(e => e.name === SEMANTIC_NORMAL);

// create an instance of the compute shader, and provide it the mesh vertex buffer
const compute = new Compute(device, shader, 'ComputeModifyVB');
compute.setParameter('vb', mesh.vertexBuffer);
compute.setParameter('count', mesh.vertexBuffer.numVertices);
compute.setParameter('positionOffset', positionElement?.offset / 4); // number of floats offset
compute.setParameter('normalOffset', normalElement?.offset / 4); // number of floats offset

let time = 0;
app.on('update', (dt) => {
    time += dt;
    if (entity) {
        // update non-constant parameters each frame
        compute.setParameter('time', time);

        // set up both dispatches
        compute.setupDispatch(mesh.vertexBuffer.numVertices);

        // dispatch the compute shader
        device.computeDispatch([compute], 'ModifyVBDispatch');

        // solid / wireframe
        entity.render.renderStyle = Math.floor(time * 0.5) % 2 ? RENDERSTYLE_WIREFRAME : RENDERSTYLE_SOLID;
    }
});
