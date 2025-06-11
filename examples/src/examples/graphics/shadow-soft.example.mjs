import { data } from 'examples/observer';
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

    data.set('settings', {
        light: {
            soft: true,
            shadowResolution: 2048,
            penumbraSize: 20,
            penumbraFalloff: 4,
            shadowSamples: 16,
            shadowBlockerSamples: 16
        }
    });

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

    // get the clouds so that we can animate them
    /** @type {Array<pc.Entity>} */
    const srcClouds = terrain.find((node) => {
        const isCloud = node.name.includes('Icosphere');

        if (isCloud) {
            // no shadow receiving for clouds
            node.render.receiveShadows = false;
        }

        return isCloud;
    });

    // clone some additional clouds
    /** @type {Array<pc.Entity>} */
    const clouds = [];
    srcClouds.forEach((cloud) => {
        clouds.push(cloud);

        for (let i = 0; i < 3; i++) {
            /** @type {pc.Entity} */
            const clone = cloud.clone();
            cloud.parent.addChild(clone);
            clouds.push(clone);
        }
    });

    // shuffle the array to give clouds random order
    clouds.sort(() => Math.random() - 0.5);

    // a large orange pillar
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(1, 0.5, 0);
    const pillar = new pc.Entity('sphere');
    pillar.addComponent('render', {
        type: 'box',
        material: material
    });
    pillar.setLocalScale(10, 130, 10);
    pillar.setLocalPosition(180, 50, 110);
    app.root.addChild(pillar);

    // find a tree in the middle to use as a focus point
    const tree = terrain.findOne('name', 'Arbol 2.002');

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
            focusEntity: tree,
            distanceMax: 600
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // Create a directional light casting soft shadows
    const dirLight = new pc.Entity('Cascaded Light');
    dirLight.addComponent('light', {
        ...{
            type: 'directional',
            color: pc.Color.WHITE,
            shadowBias: 0.3,
            normalOffsetBias: 0.2,
            intensity: 1.0,

            // enable shadow casting
            castShadows: true,
            shadowType: data.get('settings.light.soft') ? pc.SHADOW_PCSS_32F : pc.SHADOW_PCF3_32F,
            shadowDistance: 1000
        },
        ...data.get('settings.light')
    });
    app.root.addChild(dirLight);
    dirLight.setLocalEulerAngles(75, 120, 20);

    // handle HUD changes - update properties on the light
    data.on('*:set', (/** @type {string} */ path, value) => {
        const pathArray = path.split('.');
        if (pathArray[2] === 'soft') {
            dirLight.light.shadowType = value ? pc.SHADOW_PCSS_32F : pc.SHADOW_PCF3_32F;
        } else {
            dirLight.light[pathArray[2]] = value;
        }
    });

    const cloudSpeed = 0.2;
    let frameNumber = 0;
    let time = 0;
    app.on('update', (/** @type {number} */ dt) => {
        time += dt;

        // on the first frame, when camera is updated, move it further away from the focus tree
        if (frameNumber === 0) {
            // @ts-ignore engine-tsd
            camera.script.orbitCamera.distance = 470;
        }

        // move the clouds around
        clouds.forEach((cloud, index) => {
            const redialOffset = (index / clouds.length) * (6.24 / cloudSpeed);
            const radius = 9 + 4 * Math.sin(redialOffset);
            const cloudTime = time + redialOffset;
            cloud.setLocalPosition(
                2 + radius * Math.sin(cloudTime * cloudSpeed),
                4,
                -5 + radius * Math.cos(cloudTime * cloudSpeed)
            );
        });

        frameNumber++;
    });
});

export { app };
