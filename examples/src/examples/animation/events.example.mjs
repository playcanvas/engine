import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    model: new pc.Asset('model', 'container', { url: rootPath + '/static/assets/models/bitmoji.glb' }),
    walkAnim: new pc.Asset('walkAnim', 'container', { url: rootPath + '/static/assets/animations/bitmoji/walk.glb' }),
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
createOptions.elementInput = new pc.ElementInput(canvas);

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
    // setup skydome
    app.scene.exposure = 2;
    app.scene.skyboxMip = 2;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxIntensity = 0.4; // make it darker

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    cameraEntity.translate(0, 1, 0);

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

    const boxes = {};
    /** @type {pc.Entity[]} */
    const highlightedBoxes = [];

    // create a floor made up of box models
    for (let i = -5; i <= 5; i++) {
        for (let j = -5; j <= 5; j++) {
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(0.7, 0.7, 0.7);
            material.gloss = 0.3;
            material.metalness = 0.2;
            material.useMetalness = true;
            material.update();

            const box = new pc.Entity();
            boxes[`${i}${j}`] = box;
            box.addComponent('render', {
                type: 'box',
                material: material
            });
            box.setPosition(i, -0.5, j);
            box.setLocalScale(0.95, 1, 0.95);
            app.root.addChild(box);
        }
    }

    /**
     * Light up a box at the given position with a random color using the emissive material property.
     *
     * @param {pc.Vec3} pos - The position of the box to light up.
     */
    const highlightBox = (pos) => {
        const i = Math.floor(pos.x + 0.5);
        const j = Math.floor(pos.z + 0.5);
        const colorVec = new pc.Vec3(Math.random(), Math.random(), Math.random());
        colorVec.mulScalar(1 / colorVec.length());
        boxes[`${i}${j}`].render.material.emissive = new pc.Color(colorVec.x, colorVec.y, colorVec.z);
        highlightedBoxes.push(boxes[`${i}${j}`]);
    };

    // create an entity from the loaded model using the render component
    const modelEntity = assets.model.resource.instantiateRenderEntity({
        castShadows: true
    });

    // add an anim component to the entity
    modelEntity.addComponent('anim', {
        activate: true
    });
    modelEntity.setLocalPosition(-3, 0, 0);

    const modelEntityParent = new pc.Entity();
    modelEntityParent.addChild(modelEntity);

    app.root.addChild(modelEntityParent);

    // rotate the model in a circle around the center of the scene
    app.on('update', (/** @type {number} */ dt) => {
        modelEntityParent.rotate(0, 13.8 * dt, 0);
    });

    const walkTrack = assets.walkAnim.resource.animations[0].resource;

    // Add two anim events to the walk animation, one for each foot step. These events should occur just as each foot touches the ground
    walkTrack.events = new pc.AnimEvents([
        {
            time: walkTrack.duration * 0.1,
            name: 'foot_step',
            bone: 'R_foot0002_bind_JNT'
        },
        {
            time: walkTrack.duration * 0.6,
            name: 'foot_step',
            bone: 'L_foot0002_bind_JNT'
        }
    ]);

    // add the animation track to the anim component, with a defined speed
    modelEntity.anim.assignAnimation('Walk', walkTrack, undefined, 0.62);

    modelEntity.anim.on('foot_step', (event) => {
        // highlight the box that is under the foot's bone position
        highlightBox(modelEntity.findByName(event.bone).getPosition());
    });

    app.on('update', () => {
        // on update, iterate over any currently highlighted boxes and reduce their emissive property
        highlightedBoxes.forEach((box) => {
            const material = box.render.material;
            const emissive = material.emissive;
            emissive.lerp(emissive, pc.Color.BLACK, 0.08);
            material.update();
        });
        // remove old highlighted boxes from the update loop
        while (highlightedBoxes.length > 5) {
            highlightedBoxes.shift();
        }

        // set the camera to follow the model
        const modelPosition = modelEntity.getPosition().clone();
        modelPosition.y = 0.5;
        cameraEntity.lookAt(modelPosition);
    });
    app.start();
});

export { app };
