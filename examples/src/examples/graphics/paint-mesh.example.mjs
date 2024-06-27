import * as pc from 'playcanvas';
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// load the textures
const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    color: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/seaside-rocks01-color.jpg' }, { srgb: true }),
    decal: new pc.Asset('color', 'texture', { url: rootPath + '/static/assets/textures/heart.png' }, { srgb: true })
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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.CubemapHandler];

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

    app.scene.envAtlas = assets.helipad.resource;
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxIntensity = 1;
    app.scene.skyboxMip = 2;

    /**
     * helper function to create high polygon version of a sphere and sets up an entity to allow it to be added to the scene
     * @param {pc.Material} material - The material.
     * @param {number[]} layer - The render component's layers.
     * @returns {pc.Entity} The returned entity.
     */
    const createHighQualitySphere = function (material, layer) {
        // Create Entity and add it to the scene
        const entity = new pc.Entity('HighResSphere');
        app.root.addChild(entity);

        // create hight resolution sphere
        const mesh = pc.Mesh.fromGeometry(
            app.graphicsDevice,
            new pc.SphereGeometry({ latitudeBands: 200, longitudeBands: 200 })
        );

        // Add a render component with the mesh
        entity.addComponent('render', {
            type: 'asset',
            layers: layer,
            meshInstances: [new pc.MeshInstance(mesh, material)]
        });

        return entity;
    };

    // We render decals to a texture, so create a render target for it. Note that the texture needs
    // to be of renderable format here, and so it cannot be compressed.
    const texture = assets.color.resource;
    const renderTarget = new pc.RenderTarget({
        colorBuffer: texture,
        depth: false
    });

    // create a layer for rendering to decals
    const decalLayer = new pc.Layer({ name: 'decalLayer' });
    app.scene.layers.insert(decalLayer, 0);

    // Create a camera, which renders decals using a decalLayer, and renders before the main camera
    // Note that this camera does not need its position set, as it's only used to trigger
    // the rendering, but the camera matrix is not used for the rendering (our custom shader
    // does not need it).
    const decalCamera = new pc.Entity('DecalCamera');
    decalCamera.addComponent('camera', {
        clearColorBuffer: false,
        layers: [decalLayer.id],
        renderTarget: renderTarget,
        priority: -1
    });
    app.root.addChild(decalCamera);

    // Create main camera, which renders entities in world layer - this is where we show mesh with decals
    const camera = new pc.Entity('MainCamera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1, 1)
    });
    camera.translate(20, 10, 40);
    camera.lookAt(new pc.Vec3(0, -7, 0));
    app.root.addChild(camera);

    // material used on the sphere
    const material = new pc.StandardMaterial();
    material.diffuseMap = texture;
    material.gloss = 0.6;
    material.metalness = 0.4;
    material.useMetalness = true;
    material.update();

    // sphere with the texture
    const worldLayer = app.scene.layers.getLayerByName('World');
    const meshEntity = createHighQualitySphere(material, [worldLayer.id]);
    meshEntity.setLocalScale(15, 15, 15);

    // Create the shader from the vertex and fragment shaders
    const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
        aPosition: pc.SEMANTIC_POSITION,
        aUv0: pc.SEMANTIC_TEXCOORD0
    });

    // Create a decal material with the new shader
    const decalMaterial = new pc.Material();
    decalMaterial.cull = pc.CULLFACE_NONE;
    decalMaterial.shader = shader;
    decalMaterial.blendType = pc.BLEND_NORMAL;
    decalMaterial.setParameter('uDecalMap', assets.decal.resource);

    // To render into uv space of the mesh, we need to render the mesh using our custom shader into
    // the texture. In order to do this, we creates a new entity, containing the same mesh instances,
    // but using our custom shader. We make it a child of the original entity, to use its transform.
    const meshInstances = meshEntity.render.meshInstances.map((srcMeshInstance) => {
        return new pc.MeshInstance(srcMeshInstance.mesh, decalMaterial);
    });
    const cloneEntity = new pc.Entity('cloneEntity');
    cloneEntity.addComponent('render', {
        meshInstances: meshInstances,
        layers: [decalLayer.id],
        castShadows: false,
        receiveShadows: false
    });
    meshEntity.addChild(cloneEntity);

    // Create an entity with a directional light component
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        intensity: 3
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(45, 90, 0);

    // update things each frame
    let time = 0;
    let decalTime = 0;
    const decalFrequency = 0.5;
    app.on('update', function (dt) {
        time += dt * 0.7;

        // a decal projection box is an orthographic projection from some position. We calculate position
        // here to be in an orbit around the sphere. Draw a line showing the projection point and direction.
        const decalProjectionPos = new pc.Vec3(8 * Math.cos(time), 8 * Math.cos(time * 0.3), 8 * Math.sin(time));
        app.drawLine(decalProjectionPos, pc.Vec3.ZERO, pc.Color.WHITE);

        // render recal every half a second
        decalTime += dt;
        if (decalTime > decalFrequency) {
            decalTime -= decalFrequency;

            // enable decal camera, which renders the decal
            decalCamera.enabled = true;

            // construct a view matrix, looking from the decal position to the center of the sphere
            const viewMatrix = new pc.Mat4().setLookAt(decalProjectionPos, pc.Vec3.ZERO, pc.Vec3.UP);
            viewMatrix.invert();

            // ortographics projection matrix - this defines the size of the decal, but also its depth range (0..5)
            const projMatrix = new pc.Mat4().setOrtho(-1, 1, -1, 1, 0, 5);

            // final matrix is a combination of view and projection matrix. Make it available to the shader.
            const viewProj = new pc.Mat4();
            viewProj.mul2(projMatrix, viewMatrix);
            decalMaterial.setParameter('matrix_decal_viewProj', viewProj.data);
        } else {
            // otherwise the decal camera is disabled
            decalCamera.enabled = false;
        }

        // draw the texture we render decals to for demonstration purposes
        // @ts-ignore engine-tsd
        app.drawTexture(0, -0.6, 1.4, 0.6, texture);
    });
});

export { app };
