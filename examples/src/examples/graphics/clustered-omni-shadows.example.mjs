import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    normal: new pc.Asset('normal', 'texture', { url: rootPath + '/static/assets/textures/normal-map.png' }),
    xmas_negx: new pc.Asset('xmas_negx', 'texture', {
        url: rootPath + '/static/assets/cubemaps/xmas_faces/xmas_negx.png'
    }),
    xmas_negy: new pc.Asset('xmas_negy', 'texture', {
        url: rootPath + '/static/assets/cubemaps/xmas_faces/xmas_negy.png'
    }),
    xmas_negz: new pc.Asset('xmas_negz', 'texture', {
        url: rootPath + '/static/assets/cubemaps/xmas_faces/xmas_negz.png'
    }),
    xmas_posx: new pc.Asset('xmas_posx', 'texture', {
        url: rootPath + '/static/assets/cubemaps/xmas_faces/xmas_posx.png'
    }),
    xmas_posy: new pc.Asset('xmas_posy', 'texture', {
        url: rootPath + '/static/assets/cubemaps/xmas_faces/xmas_posy.png'
    }),
    xmas_posz: new pc.Asset('xmas_posz', 'texture', {
        url: rootPath + '/static/assets/cubemaps/xmas_faces/xmas_posz.png'
    })
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
createOptions.resourceHandlers = [pc.ScriptHandler, pc.TextureHandler, pc.CubemapHandler];

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

    data.set('settings', {
        shadowAtlasResolution: 1300, // shadow map resolution storing all shadows
        shadowType: pc.SHADOW_PCF3, // shadow filter type
        shadowsEnabled: true,
        cookiesEnabled: true
    });

    // enabled clustered lighting. This is a temporary API and will change in the future
    app.scene.clusteredLightingEnabled = true;

    // adjust default clustered lighting parameters to handle many lights
    const lighting = app.scene.lighting;

    // 1) subdivide space with lights into this many cells
    lighting.cells = new pc.Vec3(16, 12, 16);

    // 2) and allow this many lights per cell
    lighting.maxLightsPerCell = 12;

    // enable clustered shadows (it's enabled by default as well)
    lighting.shadowsEnabled = true;

    // enable clustered cookies
    lighting.cookiesEnabled = true;

    // resolution of the shadow and cookie atlas
    lighting.shadowAtlasResolution = data.get('settings.shadowAtlasResolution');
    lighting.cookieAtlasResolution = 2048;

    /**
     * helper function to create a 3d primitive including its material
     * @param {string} primitiveType - The primitive type.
     * @param {pc.Vec3} position - The position.
     * @param {pc.Vec3} scale - The scale.
     * @returns {pc.Entity} The returned entity.
     */
    function createPrimitive(primitiveType, position, scale) {
        // create a material
        const material = new pc.StandardMaterial();
        material.diffuse = new pc.Color(0.7, 0.7, 0.7);

        // normal map
        material.normalMap = assets.normal.resource;
        material.normalMapTiling.set(5, 5);
        material.bumpiness = 0.7;

        // enable specular
        material.gloss = 0.4;
        material.metalness = 0.3;
        material.useMetalness = true;

        material.update();

        // create the primitive using the material
        const primitive = new pc.Entity();
        primitive.addComponent('render', {
            type: primitiveType,
            material: material
        });

        // set position and scale and add it to scene
        primitive.setLocalPosition(position);
        primitive.setLocalScale(scale);
        app.root.addChild(primitive);

        return primitive;
    }

    // create the ground plane from the boxes
    createPrimitive('box', new pc.Vec3(0, 0, 0), new pc.Vec3(800, 2, 800));
    createPrimitive('box', new pc.Vec3(0, 400, 0), new pc.Vec3(800, 2, 800));

    // walls
    createPrimitive('box', new pc.Vec3(400, 200, 0), new pc.Vec3(2, 400, 800));
    createPrimitive('box', new pc.Vec3(-400, 200, 0), new pc.Vec3(2, 400, 800));
    createPrimitive('box', new pc.Vec3(0, 200, 400), new pc.Vec3(800, 400, 0));
    createPrimitive('box', new pc.Vec3(0, 200, -400), new pc.Vec3(800, 400, 0));

    const numTowers = 7;
    for (let i = 0; i < numTowers; i++) {
        let scale = 25;
        const fraction = (i / numTowers) * Math.PI * 2;
        const radius = i % 2 ? 340 : 210;
        for (let y = 0; y <= 7; y++) {
            const prim = createPrimitive(
                'box',
                new pc.Vec3(radius * Math.sin(fraction), 2 + y * 25, radius * Math.cos(fraction)),
                new pc.Vec3(scale, scale, scale)
            );
            prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
        }
        scale -= 1.5;
    }

    // construct the cubemap asset for the omni light cookie texture
    // Note: the textures array could contain 6 texture asset names to load instead as well
    const cubemapAsset = new pc.Asset('xmas_cubemap', 'cubemap', null, {
        textures: [
            assets.xmas_posx.id,
            assets.xmas_negx.id,
            assets.xmas_posy.id,
            assets.xmas_negy.id,
            assets.xmas_posz.id,
            assets.xmas_negz.id
        ],

        // don't generate mipmaps for the cookie cubemap if clustered lighting is used,
        // as only top levels are copied to the cookie atlas.
        mipmaps: !app.scene.clusteredLightingEnabled
    });
    cubemapAsset.loadFaces = true;
    app.assets.add(cubemapAsset);

    /** @type {Array<pc.Entity>} */
    const omniLights = [];
    const numLights = 10;
    for (let i = 0; i < numLights; i++) {
        const lightOmni = new pc.Entity('Omni');
        lightOmni.addComponent('light', {
            type: 'omni',
            color: pc.Color.WHITE,
            intensity: 10 / numLights,
            range: 350,
            castShadows: true,
            shadowBias: 0.2,
            normalOffsetBias: 0.2,

            // cookie texture
            cookieAsset: cubemapAsset,
            cookieChannel: 'rgb'
        });

        // attach a render component with a small sphere to it
        const material = new pc.StandardMaterial();
        material.emissive = pc.Color.WHITE;
        material.update();

        lightOmni.addComponent('render', {
            type: 'sphere',
            material: material,
            castShadows: false
        });
        lightOmni.setPosition(0, 120, 0);
        lightOmni.setLocalScale(5, 5, 5);
        app.root.addChild(lightOmni);

        omniLights.push(lightOmni);
    }

    // create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        fov: 80,
        clearColor: new pc.Color(0.1, 0.1, 0.1),
        farClip: 1500
    });

    // and position it in the world
    camera.setLocalPosition(300, 120, 25);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: app.root,
            distanceMax: 1200,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // handle HUD changes - update properties on the scene
    data.on('*:set', (/** @type {string} */ path, value) => {
        const pathArray = path.split('.');
        // @ts-ignore
        lighting[pathArray[1]] = value;
    });

    // Set an update function on the app's update event
    let time = 0;
    app.on('update', function (/** @type {number} */ dt) {
        time += dt * 0.3;
        const radius = 250;
        for (let i = 0; i < omniLights.length; i++) {
            const fraction = (i / omniLights.length) * Math.PI * 2;
            omniLights[i].setPosition(
                radius * Math.sin(time + fraction),
                190 + Math.sin(time + fraction) * 150,
                radius * Math.cos(time + fraction)
            );
        }

        // display shadow texture (debug feature)
        if (app.graphicsDevice.isWebGPU) {
            // @ts-ignore engine-tsd
            app.drawTexture(
                -0.7,
                -0.7,
                0.5,
                0.5,
                app.renderer.lightTextureAtlas.shadowAtlas.texture,
                undefined,
                undefined,
                false
            );
        }
    });
});

export { app };
