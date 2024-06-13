import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    model: new pc.Asset('model', 'container', { url: rootPath + '/static/assets/models/bitmoji.glb' }),
    idleAnim: new pc.Asset('idleAnim', 'container', { url: rootPath + '/static/assets/animations/bitmoji/idle.glb' }),
    idleEagerAnim: new pc.Asset('idleEagerAnim', 'container', {
        url: rootPath + '/static/assets/animations/bitmoji/idle-eager.glb'
    }),
    walkAnim: new pc.Asset('walkAnim', 'container', { url: rootPath + '/static/assets/animations/bitmoji/walk.glb' }),
    danceAnim: new pc.Asset('danceAnim', 'container', {
        url: rootPath + '/static/assets/animations/bitmoji/win-dance.glb'
    }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    bloom: new pc.Asset('bloom', 'script', { url: rootPath + '/static/scripts/posteffects/posteffect-bloom.js' })
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
    pc.ScriptComponentSystem,
    pc.AnimComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler
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
    // setup data
    data.set('fullBodyLayer', {
        state: 'Idle',
        blendType: pc.ANIM_LAYER_OVERWRITE
    });
    data.set('upperBodyLayer', {
        state: 'Eager',
        blendType: pc.ANIM_LAYER_ADDITIVE,
        useMask: true
    });
    data.set('options', {
        blend: 0.5,
        skeleton: true
    });

    // setup skydome
    app.scene.exposure = 2;
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    cameraEntity.translate(0, 0.75, 3);

    // add bloom postprocessing (this is ignored by the picker)
    cameraEntity.addComponent('script');
    cameraEntity.script.create('bloom', {
        attributes: {
            bloomIntensity: 1,
            bloomThreshold: 0.7,
            blurAmount: 4
        }
    });
    app.root.addChild(cameraEntity);

    // Create an entity with a light component
    const lightEntity = new pc.Entity();
    lightEntity.addComponent('light', {
        castShadows: true,
        intensity: 1.5,
        normalOffsetBias: 0.02,
        shadowType: pc.SHADOW_PCF5,
        shadowDistance: 6,
        shadowResolution: 2048,
        shadowBias: 0.02
    });
    app.root.addChild(lightEntity);
    lightEntity.setLocalEulerAngles(45, 30, 0);

    // create an entity from the loaded model using the render component
    const modelEntity = assets.model.resource.instantiateRenderEntity({
        castShadows: true
    });
    modelEntity.addComponent('anim', {
        activate: true
    });
    app.root.addChild(modelEntity);

    // retrieve the animation assets
    const idleTrack = assets.idleAnim.resource.animations[0].resource;
    const walkTrack = assets.walkAnim.resource.animations[0].resource;
    const danceTrack = assets.danceAnim.resource.animations[0].resource;
    const idleEagerTrack = assets.idleEagerAnim.resource.animations[0].resource;

    // create the full body layer by assigning full body animations to the anim component
    modelEntity.anim.assignAnimation('Idle', idleTrack);
    modelEntity.anim.assignAnimation('Walk', walkTrack);

    // set the default weight for the base layer
    modelEntity.anim.baseLayer.weight = 1.0 - data.get('options.blend');

    // create a mask for the upper body layer
    const upperBodyMask = {
        // set a path with the children property as true to include that path and all of its children in the mask
        'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
            children: true
        },
        // set a path to true in the mask to include only that specific path
        'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT/C_Head': true
    };

    // create a new layer for the upper body, with additive layer blending
    const upperBodyLayer = modelEntity.anim.addLayer(
        'UpperBody',
        data.get('options.blend'),
        upperBodyMask,
        data.get('upperBodyLayer.blendType')
    );
    upperBodyLayer.assignAnimation('Eager', idleEagerTrack);
    upperBodyLayer.assignAnimation('Idle', idleTrack);
    upperBodyLayer.assignAnimation('Dance', danceTrack);

    // respond to changes in the data object made by the control panel
    data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
        if (path === 'fullBodyLayer.state') {
            modelEntity.anim.baseLayer.transition(value, 0.4);
        }
        if (path === 'upperBodyLayer.state') {
            upperBodyLayer.transition(value, 0.4);
        }
        if (path === 'fullBodyLayer.blendType') {
            modelEntity.anim.baseLayer.blendType = value;
        }
        if (path === 'upperBodyLayer.blendType') {
            upperBodyLayer.blendType = value;
        }
        if (path === 'upperBodyLayer.useMask') {
            upperBodyLayer.mask = value ?
                {
                    'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
                        children: true
                    }
                } :
                null;
        }
        if (path === 'options.blend') {
            modelEntity.anim.baseLayer.weight = 1.0 - value;
            upperBodyLayer.weight = value;
        }
    });

    /**
     * @param {pc.Entity} entity - The entity to draw the skeleton for.
     */
    const drawSkeleton = (entity) => {
        entity.children.forEach((/** @type {pc.Entity} */ c) => {
            const target = modelEntity.anim._targets[entity.path + '/graph/localPosition'];
            if (target) {
                app.drawLine(
                    entity.getPosition(),
                    c.getPosition(),
                    new pc.Color(target.getWeight(0), 0, target.getWeight(1), 1),
                    false
                );
            }
            drawSkeleton(c);
        });
    };

    app.start();

    app.on('update', () => {
        if (data.get('options.skeleton')) {
            drawSkeleton(modelEntity);
        }
    });
});

export { app };
