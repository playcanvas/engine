// @config WEBGL_DISABLED
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';
import files from 'examples/files';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    color: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' }),
    normal: new pc.Asset('normal', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-normal.jpg' }),
    gloss: new pc.Asset('gloss', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
    orbit: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/table-mountain-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];

createOptions.resourceHandlers = [pc.TextureHandler, pc.ScriptHandler];

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
    app.scene.skyboxMip = 2;
    app.scene.exposure = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // sphere material
    const material = new pc.StandardMaterial();
    material.diffuseMap = assets.color.resource;
    material.normalMap = assets.normal.resource;
    material.glossMap = assets.gloss.resource;
    material.update();

    // sphere mesh and entity
    const entity = new pc.Entity('Sphere');
    app.root.addChild(entity);

    const geom = new pc.SphereGeometry({
        radius: 1,
        latitudeBands: 100,
        longitudeBands: 100
    });

    const mesh = pc.Mesh.fromGeometry(device, geom, {
        storageVertex: true // allow vertex buffer to be accessible by compute shader
    });

    // Add a render component with the mesh
    entity.addComponent('render', {
        meshInstances: [new pc.MeshInstance(mesh, material)]
    });
    app.root.addChild(entity);

    // Create an orbit camera
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
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
        new pc.Shader(device, {
            name: 'ComputeShader',
            shaderLanguage: pc.SHADERLANGUAGE_WGSL,
            cshader: files['compute-shader.wgsl'],

              // format of a uniform buffer used by the compute shader
            computeUniformBufferFormats: {
                ub: new pc.UniformBufferFormat(device, [
                    new pc.UniformFormat('count', pc.UNIFORMTYPE_UINT),
                    new pc.UniformFormat('positionOffset', pc.UNIFORMTYPE_UINT),
                    new pc.UniformFormat('normalOffset', pc.UNIFORMTYPE_UINT),
                    new pc.UniformFormat('time', pc.UNIFORMTYPE_FLOAT)
                ])
            },

              // format of a bind group, providing resources for the compute shader
            computeBindGroupFormat: new pc.BindGroupFormat(device, [
                  // a uniform buffer we provided format for
                new pc.BindUniformBufferFormat('ub', pc.SHADERSTAGE_COMPUTE),
                  // the vertex buffer we want to modify
                new pc.BindStorageBufferFormat('vb', pc.SHADERSTAGE_COMPUTE)
            ])
        }) :
        null;

    // information about the vertex buffer format - offset of position and normal attributes
    // Note: data is stored non-interleaved, positions together, normals together, so no need
    // to worry about stride
    const format = mesh.vertexBuffer.format;
    const positionElement = format.elements.find(e => e.name === pc.SEMANTIC_POSITION);
    const normalElement = format.elements.find(e => e.name === pc.SEMANTIC_NORMAL);

    // create an instance of the compute shader, and provide it the mesh vertex buffer
    const compute = new pc.Compute(device, shader, 'ComputeModifyVB');
    compute.setParameter('vb', mesh.vertexBuffer);
    compute.setParameter('count', mesh.vertexBuffer.numVertices);
    compute.setParameter('positionOffset', positionElement?.offset / 4); // number of floats offset
    compute.setParameter('normalOffset', normalElement?.offset / 4); // number of floats offset

    let time = 0;
    app.on('update', function (dt) {
        time += dt;
        if (entity) {
            // update non-constant parameters each frame
            compute.setParameter('time', time);

            // set up both dispatches
            compute.setupDispatch(mesh.vertexBuffer.numVertices);

            // dispatch the compute shader
            device.computeDispatch([compute]);

            // solid / wireframe
            entity.render.renderStyle = Math.floor(time * 0.5) % 2 ? pc.RENDERSTYLE_WIREFRAME : pc.RENDERSTYLE_SOLID;
        }
    });
});

export { app };
