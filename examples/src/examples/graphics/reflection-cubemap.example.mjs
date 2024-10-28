import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/utils/cubemap-renderer.js' })
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

    // set up some general scene rendering properties
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // setup skydome
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxMip = 0; // use top mipmap level of cubemap (full resolution)
    app.scene.skyboxIntensity = 2; // make it brighter

    /**
     * helper function to create high polygon version of a sphere and sets up an entity to allow it to be added to the scene
     * @param {pc.Material} material - The material.
     * @param {number[]} layer - The render component's layers.
     * @returns {pc.Entity} The returned entity.
     */
    const createHighQualitySphere = function (material, layer) {
        // Create Entity and add it to the scene
        const entity = new pc.Entity('ShinyBall');
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

    /**
     * helper function to create a primitive with shape type, position, scale, color and layer
     * @param {string} primitiveType - The primitive type.
     * @param {number | pc.Vec3} position - The entity's position.
     * @param {number | pc.Vec3} scale - The entisy's scale.
     * @param {pc.Color} color - The color.
     * @param {number[]} layer - The render component's layers.
     * @returns {pc.Entity} The returned entity.
     */
    function createPrimitive(primitiveType, position, scale, color, layer) {
        // create material of specified color
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.gloss = 0.6;
        material.metalness = 0.7;
        material.useMetalness = true;
        material.update();

        // create primitive
        const primitive = new pc.Entity();
        primitive.addComponent('render', {
            type: primitiveType,
            layers: layer,
            material: material
        });

        // set position and scale and add it to scene
        primitive.setLocalPosition(position);
        primitive.setLocalScale(scale);
        app.root.addChild(primitive);

        return primitive;
    }

    // get existing layers
    const worldLayer = app.scene.layers.getLayerByName('World');
    const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
    const immediateLayer = app.scene.layers.getLayerByName('Immediate');
    const uiLayer = app.scene.layers.getLayerByName('UI');

    // create a layer for object that do not render into texture
    const excludedLayer = new pc.Layer({ name: 'Excluded' });
    app.scene.layers.push(excludedLayer);

    // create material for the shiny ball
    const shinyMat = new pc.StandardMaterial();

    // create shiny ball mesh - this is on excluded layer as it does not render to cubemap
    const shinyBall = createHighQualitySphere(shinyMat, [excludedLayer.id]);
    shinyBall.setLocalPosition(0, 0, 0);
    shinyBall.setLocalScale(10, 10, 10);

    // add camera component to shiny ball - this defines camera properties for cubemap rendering
    shinyBall.addComponent('camera', {
        // optimization - clear the surface even though all pixels are overwritten,
        // as this has performance benefits on tiled architectures
        clearColorBuffer: true,

        // cubemap camera will render objects on world layer and also skybox
        layers: [worldLayer.id, skyboxLayer.id],

        // priority - render before world camera
        priority: -1,

        // disable as this is not a camera that renders cube map but only a container for properties for cube map rendering
        enabled: false
    });

    // add cubemapRenderer script component which takes care of rendering dynamic cubemap
    shinyBall.addComponent('script');
    shinyBall.script.create('cubemapRenderer', {
        attributes: {
            resolution: 256,
            mipmaps: true,
            depth: true
        }
    });

    // finish set up of shiny material - make reflection a bit darker
    shinyMat.diffuse = new pc.Color(0.6, 0.6, 0.6);

    // use cubemap which is generated by cubemapRenderer instead of global skybox cubemap
    shinyMat.useSkybox = false;
    // @ts-ignore engine-tsd
    shinyMat.cubeMap = shinyBall.script.cubemapRenderer.cubeMap;

    // make it shiny without diffuse component
    shinyMat.metalness = 1;
    shinyMat.useMetalness = true;
    shinyMat.update();

    /**
     * create few random primitives in the world layer
     * @type {pc.Entity[]}
     */
    const entities = [];
    const shapes = ['box', 'cone', 'cylinder', 'sphere', 'capsule'];
    for (let i = 0; i < 6; i++) {
        const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
        const color = new pc.Color(Math.random(), Math.random(), Math.random());
        entities.push(createPrimitive(shapeName, pc.Vec3.ZERO, new pc.Vec3(3, 3, 3), color, [worldLayer.id]));
    }

    // create green plane as a base to cast shadows on
    createPrimitive('plane', new pc.Vec3(0, -8, 0), new pc.Vec3(20, 20, 20), new pc.Color(0.3, 0.5, 0.3), [
        worldLayer.id
    ]);

    // Create main camera, which renders entities in world, excluded and skybox layers
    const camera = new pc.Entity('MainCamera');
    camera.addComponent('camera', {
        fov: 60,
        layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id, immediateLayer.id, uiLayer.id]
    });
    app.root.addChild(camera);

    // Create an Entity with a directional light component
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: pc.Color.YELLOW,
        range: 40,
        castShadows: true,
        layers: [worldLayer.id],
        shadowBias: 0.2,
        shadowResolution: 1024,
        normalOffsetBias: 0.05,
        shadowDistance: 40
    });
    app.root.addChild(light);

    /**
     * helper function to create a texture that can be used to project cubemap to
     * @param {string} projection - The texture's projection.
     * @param {number} size - Width and height of texture.
     * @returns {pc.Texture} The texture.
     */
    function createReprojectionTexture(projection, size) {
        return new pc.Texture(app.graphicsDevice, {
            width: size,
            height: size,
            format: pc.PIXELFORMAT_RGB8,
            mipmaps: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
            projection: projection
        });
    }

    // create 2 uqirect and 2 octahedral textures
    const textureEqui = createReprojectionTexture(pc.TEXTUREPROJECTION_EQUIRECT, 256);
    const textureEqui2 = createReprojectionTexture(pc.TEXTUREPROJECTION_EQUIRECT, 256);
    const textureOcta = createReprojectionTexture(pc.TEXTUREPROJECTION_OCTAHEDRAL, 64);
    const textureOcta2 = createReprojectionTexture(pc.TEXTUREPROJECTION_OCTAHEDRAL, 32);

    // create one envAtlas texture
    const textureAtlas = createReprojectionTexture(pc.TEXTUREPROJECTION_OCTAHEDRAL, 512);

    // update things each frame
    let time = 0;
    app.on('update', function (dt) {
        time += dt;

        // rotate primitives around their center and also orbit them around the shiny sphere
        for (let e = 0; e < entities.length; e++) {
            const scale = (e + 1) / entities.length;
            const offset = time + e * 200;
            entities[e].setLocalPosition(7 * Math.sin(offset), 2 * (e - 3), 7 * Math.cos(offset));
            entities[e].rotate(1 * scale, 2 * scale, 3 * scale);
        }

        // slowly orbit camera around
        camera.setLocalPosition(20 * Math.cos(time * 0.2), 2, 20 * Math.sin(time * 0.2));
        camera.lookAt(pc.Vec3.ZERO);

        // project textures, and display them on the screen
        // @ts-ignore engine-tsd
        const srcCube = shinyBall.script.cubemapRenderer.cubeMap;

        // cube -> equi1
        pc.reprojectTexture(srcCube, textureEqui, {
            numSamples: 1
        });
        // @ts-ignore engine-tsd
        app.drawTexture(-0.6, 0.7, 0.6, 0.3, textureEqui);

        // cube -> octa1
        pc.reprojectTexture(srcCube, textureOcta, {
            numSamples: 1
        });
        // @ts-ignore engine-tsd
        app.drawTexture(0.7, 0.7, 0.4, 0.4, textureOcta);

        // equi1 -> octa2
        pc.reprojectTexture(textureEqui, textureOcta2, {
            specularPower: 32,
            numSamples: 1024
        });
        // @ts-ignore engine-tsd
        app.drawTexture(-0.7, -0.7, 0.4, 0.4, textureOcta2);

        // octa1 -> equi2
        pc.reprojectTexture(textureOcta, textureEqui2, {
            specularPower: 16,
            numSamples: 512
        });
        // @ts-ignore engine-tsd
        app.drawTexture(0.6, -0.7, 0.6, 0.3, textureEqui2);

        // cube -> envAtlas
        pc.EnvLighting.generateAtlas(srcCube, {
            target: textureAtlas
        });
        // @ts-ignore engine-tsd
        app.drawTexture(0, -0.7, 0.5, 0.4, textureAtlas);
    });
});

export { app };
