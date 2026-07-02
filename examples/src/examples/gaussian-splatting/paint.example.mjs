// @config
//
// 3D painting on gaussian splats using GSplatProcessor.
//
// `RMB` Paint · `LMB` Orbit
//
// @credit
// title: SA3D_R&D_XP47
// author: Stephane Agullo
// source: https://superspl.at/view?id=cdcec084
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

// shader options for gsplatprocessor - paints splats inside brush sphere
const shaderOptions = {
    // glsl process code - provides process() function with declarations
    processGLSL: `
        uniform vec4 uPaintSphere;
        uniform vec4 uPaintColor;

        void process() {
            vec3 center = getCenter();
            float dist = distance(center, uPaintSphere.xyz);
            if (dist < uPaintSphere.w) {
                // Inside brush - write paint color with intensity as alpha
                writeCustomColor(uPaintColor);
            } else {
                // Outside brush - output transparent (blender will keep existing)
                writeCustomColor(vec4(0.0));
            }
        }
    `,
    // wgsl process code
    processWGSL: `
        uniform uPaintSphere: vec4f;
        uniform uPaintColor: vec4f;

        fn process() {
            let center = getCenter();
            let dist = distance(center, uniform.uPaintSphere.xyz);
            if (dist < uniform.uPaintSphere.w) {
                writeCustomColor(uniform.uPaintColor);
            } else {
                writeCustomColor(vec4f(0.0));
            }
        }
    `
};

// work buffer modifier - blends customcolor paint texture with original splat color
const workBufferModifier = {
    glsl: `
        // Modify splat center position (no change)
        void modifySplatCenter(inout vec3 center) {
        }

        // Modify rotation/scale (no change)
        void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
        }

        // Modify color based on customColor
        void modifySplatColor(vec3 center, inout vec4 color) {
            // Read custom color using generated load function
            vec4 custom = loadCustomColor();
            if (custom.a > 0.0) {
                // Blend original color with custom color based on alpha (intensity)
                color.rgb = mix(color.rgb, custom.rgb, custom.a);
            }
        }
    `,
    wgsl: `
        // Modify splat center position (no change)
        fn modifySplatCenter(center: ptr<function, vec3f>) {
        }

        // Modify rotation/scale (no change)
        fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
        }

        // Modify color based on customColor
        fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
            // Read custom color using generated load function
            let custom = loadCustomColor();
            if (custom.a > 0.0) {
                // Blend original color with custom color based on alpha (intensity)
                (*color).r = mix((*color).r, custom.r, custom.a);
                (*color).g = mix((*color).g, custom.g, custom.a);
                (*color).b = mix((*color).b, custom.b, custom.a);
            }
        }
    `
};

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
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
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// initialize control data with defaults
data.set('paintColor', [1.0, 0.0, 0.0]); // red
data.set('paintIntensity', 0.5);
data.set('brushSize', 0.15);

const assets = {
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    biker: new pc.Asset('biker', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),
    apartment: new pc.Asset('apartment', 'gsplat', { url: './assets/splats/apartment.sog' })
};

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', pc.GSPLAT_RENDERER_AUTO);

// store all paintable entities
const paintables = [];

// creates a paintable gsplat entity with position, rotation, scale, and sets up processing
const createPaintableSplat = (name, asset, position, rotation, scale) => {
    const entity = new pc.Entity(name);
    const gsplatComponent = entity.addComponent('gsplat', { asset });
    entity.setLocalPosition(...position);
    entity.setLocalEulerAngles(...rotation);
    entity.setLocalScale(...scale);
    app.root.addChild(entity);

    // add customcolor stream if not already present on the resource
    const resource = /** @type {pc.GSplatResource} */ (asset.resource);
    if (resource.format.extraStreams.length === 0) {
        resource.format.addExtraStreams([
            { name: 'customColor', format: pc.PIXELFORMAT_RGBA8, storage: pc.GSPLAT_STREAM_INSTANCE }
        ]);
    }

    // create processor for this entity's instance texture
    // this processor will read from the default stream and write to the customcolor stream. it will
    // use brush sphere to determine which splats to colorize.
    const processor = new pc.GSplatProcessor(
        device,
        { component: gsplatComponent },
        { component: gsplatComponent, streams: ['customColor'] },
        shaderOptions
    );

    // zero-initialize the customcolor texture (alpha=0 means not modified)
    const customColorTexture = gsplatComponent.getInstanceTexture('customColor');
    const texData = customColorTexture.lock();
    texData.fill(0);
    customColorTexture.unlock();

    // use alpha blending: new color replaces old based on intensity (alpha)

    processor.blendState = pc.BlendState.ALPHABLEND;

    // set up workbuffermodifier to read customcolor and blend with original
    // this modification is used when the gsplat data are written to the global workbuffer, and
    // we want to blend the customcolor with the original color.
    gsplatComponent.setWorkBufferModifier(workBufferModifier);

    paintables.push({ entity, processor });
    return entity;
};

// create paintable splats
createPaintableSplat('biker1', assets.biker, [-1.9, -0.55, 0.6], [180, -90, 0], [0.3, 0.3, 0.3]);
createPaintableSplat('biker2', assets.biker, [-3, -0.5, -0.5], [180, 180, 0], [0.3, 0.3, 0.3]);
createPaintableSplat('apartment', assets.apartment, [0, -0.5, -3], [180, 0, 0], [0.5, 0.5, 0.5]);

// camera positions
const cameraPos = new pc.Vec3(-0.98, 0.28, -2.31);
const focusPos = new pc.Vec3(-1.1, 0.13, -1.56);

// create camera with orbit camera script
const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    fov: 90,
    clearColor: new pc.Color(0, 0, 0),
    toneMapping: pc.TONEMAP_LINEAR
});
camera.setLocalPosition(cameraPos);
camera.lookAt(focusPos);
app.root.addChild(camera);

// add orbit camera script with native mouse input (lmb orbit, mmb pan, wheel zoom)
camera.addComponent('script');
const orbitCamera = camera.script.create('orbitCamera', {
    attributes: {
        frameOnStart: false,
        inertiaFactor: 0.07
    }
});
const orbitInput = camera.script.create('orbitCameraInputMouse');

// initialize orbit camera to match current camera position and focus
orbitCamera.resetAndLookAtPoint(cameraPos, focusPos);

// paint state
let isPainting = false;

// track if picker needs re-preparation (after camera moves)
let pickerDirty = true;

// disable context menu for rmb
app.mouse.disableContextMenu();

// helper to update paint color on all processors
const updatePaintColor = () => {
    const color = data.get('paintColor');
    const intensity = data.get('paintIntensity');
    // rgb from color picker, alpha is the intensity
    for (const paintable of paintables) {
        paintable.processor.setParameter('uPaintColor', [color[0], color[1], color[2], intensity]);
    }
};

// set initial paint color
updatePaintColor();

// listen for color/intensity changes
data.on('paintColor:set', updatePaintColor);
data.on('paintIntensity:set', updatePaintColor);

// create picker for world position (with depth enabled)
const picker = new pc.Picker(app, 1, 1, true);
const worldLayer = app.scene.layers.getLayerByName('World');

// prepare picker (re-prepare when camera moves)
const preparePicker = () => {
    if (pickerDirty) {
        picker.resize(canvas.clientWidth, canvas.clientHeight);
        picker.prepare(camera.camera, app.scene, [worldLayer]);
        pickerDirty = false;
    }
};

// pending paint requests - processed in update loop for consistent frame timing
const pendingPaints = [];

// temp vectors for coordinate transformation
const invMat = new pc.Mat4();
const modelPoint = new pc.Vec3();

// process pending paint requests in update loop
app.on('update', () => {
    // process all pending paint requests
    while (pendingPaints.length > 0) {
        const { worldPoint, brushRadius } = pendingPaints.shift();

        // run all processors - each transforms to its own model space
        for (const paintable of paintables) {
            // transform world position to this entity's model space
            invMat.copy(paintable.entity.getWorldTransform()).invert();
            invMat.transformPoint(worldPoint, modelPoint);

            // set paint sphere uniform and run processor
            paintable.processor.setParameter('uPaintSphere', [modelPoint.x, modelPoint.y, modelPoint.z, brushRadius]);
            paintable.processor.process();

            // trigger work buffer update for next frame to reflect the paint changes
            paintable.entity.gsplat.workBufferUpdate = pc.WORKBUFFER_UPDATE_ONCE;
        }
    }
});

// request paint at a specific screen position - queues for processing in update loop
const paintAt = (x, y) => {
    // prepare picker if needed (after camera moved)
    preparePicker();

    // get world position for the paint brush
    picker.getWorldPointAsync(x, y).then((worldPoint) => {
        if (worldPoint) {
            const brushRadius = data.get('brushSize');

            // queue paint request for processing in update loop
            pendingPaints.push({ worldPoint: worldPoint.clone(), brushRadius });
        }
    });
};

// rmb paint - disable orbit input while painting (orbit-camera handles lmb/mmb/wheel natively)
app.mouse.on(pc.EVENT_MOUSEDOWN, (e) => {
    if (e.button === pc.MOUSEBUTTON_RIGHT) {
        isPainting = true;
        pickerDirty = true;
        orbitInput.enabled = false;
        orbitInput.panButtonDown = false; // cancel pan that orbit-camera started
        paintAt(e.x, e.y);
    }
});

app.mouse.on(pc.EVENT_MOUSEMOVE, (e) => {
    if (isPainting) paintAt(e.x, e.y);
});

app.mouse.on(pc.EVENT_MOUSEUP, (e) => {
    if (e.button === pc.MOUSEBUTTON_RIGHT) {
        isPainting = false;
        orbitInput.enabled = true;
    }
});

window.addEventListener('mouseup', () => {
    isPainting = false;
    orbitInput.enabled = true;
});

// cleanup on destroy
app.on('destroy', () => {
    for (const paintable of paintables) {
        paintable.processor?.destroy();
    }
    picker.destroy();
});
