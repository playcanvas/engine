// @config DESCRIPTION <span style="color:yellow"><b>Controls:</b> Right Mouse Button - paint | Left Mouse Button - orbit </span><br>3D painting on gaussian splats using GSplatProcessor.
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

// Shader options for GSplatProcessor - paints splats inside brush sphere
const shaderOptions = {
    // GLSL process chunk - output paint color only for splats inside brush
    processGLSL: `
        vec3 center = getCenter(source);
        float dist = distance(center, uPaintSphere.xyz);
        if (dist < uPaintSphere.w) {
            // Inside brush - write paint color with intensity as alpha
            writeCustomColor(uPaintColor);
        } else {
            // Outside brush - output transparent (blender will keep existing)
            writeCustomColor(vec4(0.0));
        }
    `,
    // WGSL process chunk
    processWGSL: `
        let center = getCenter(&source);
        let dist = distance(center, uniform.uPaintSphere.xyz);
        if (dist < uniform.uPaintSphere.w) {
            writeCustomColor(uniform.uPaintColor);
        } else {
            writeCustomColor(vec4f(0.0));
        }
    `,
    // Uniform declarations (each on separate line for WGSL parser)
    declarationsGLSL: `
        uniform vec4 uPaintSphere;
        uniform vec4 uPaintColor;
    `,
    declarationsWGSL: `
        uniform uPaintSphere: vec4f;
        uniform uPaintColor: vec4f;
    `
};

// Work buffer modifier - blends customColor paint texture with original splat color
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
            // Read custom color from texture
            vec4 custom = texelFetch(customColor, splatUV, 0);
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
            // Read custom color from texture
            let custom = textureLoad(customColor, splatUV, 0);
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

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Initialize control data with defaults
data.set('paintColor', [1.0, 0.0, 0.0]); // Red
data.set('paintIntensity', 0.5);
data.set('brushSize', 0.15);

const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    biker: new pc.Asset('biker', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
    apartment: new pc.Asset('apartment', 'gsplat', { url: `${rootPath}/static/assets/splats/apartment.sog` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Store all paintable entities
    const paintables = [];

    // Creates a paintable gsplat entity with position, rotation, scale, and sets up processing
    const createPaintableSplat = (name, asset, position, rotation, scale) => {
        const entity = new pc.Entity(name);
        const gsplatComponent = entity.addComponent('gsplat', { asset, unified: true });
        entity.setLocalPosition(...position);
        entity.setLocalEulerAngles(...rotation);
        entity.setLocalScale(...scale);
        app.root.addChild(entity);

        // Add customColor stream if not already present on the resource
        const resource = /** @type {pc.GSplatResource} */ (asset.resource);
        if (resource.format.extraStreams.length === 0) {
            resource.format.addExtraStreams([
                { name: 'customColor', format: pc.PIXELFORMAT_RGBA8, storage: pc.GSPLAT_STREAM_INSTANCE }
            ]);
        }

        // Create processor for this entity's instance texture
        // This processor will read from the default stream and write to the customColor stream. It will
        // use brush sphere to determine which splats to colorize.
        const processor = new pc.GSplatProcessor(
            device,
            { component: gsplatComponent },
            { component: gsplatComponent, streams: ['customColor'] },
            shaderOptions
        );

        // Zero-initialize the customColor texture (alpha=0 means not modified)
        const customColorTexture = gsplatComponent.getInstanceTexture('customColor');
        const texData = customColorTexture.lock();
        texData.fill(0);
        customColorTexture.unlock();

        // Use alpha blending: new color replaces old based on intensity (alpha)
        // eslint-disable-next-line import/namespace
        processor.blendState = pc.BlendState.ALPHABLEND;

        // Set up workBufferModifier to read customColor and blend with original
        // This modification is used when the gsplat data are written to the global workbuffer, and
        // we want to blend the customColor with the original color.
        gsplatComponent.setWorkBufferModifier(workBufferModifier);

        paintables.push({ entity, processor });
        return entity;
    };

    // Create paintable splats
    createPaintableSplat('biker1', assets.biker, [-1.9, -0.55, 0.6], [180, -90, 0], [0.3, 0.3, 0.3]);
    createPaintableSplat('biker2', assets.biker, [-3, -0.5, -0.5], [180, 180, 0], [0.3, 0.3, 0.3]);
    createPaintableSplat('apartment', assets.apartment, [0, -0.5, -3], [180, 0, 0], [0.5, 0.5, 0.5]);

    // Camera positions
    const cameraPos = new pc.Vec3(-0.98, 0.28, -2.31);
    const focusPos = new pc.Vec3(-1.10, 0.13, -1.56);

    // Create camera with orbit camera script
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
        fov: 90,
        clearColor: new pc.Color(0, 0, 0),
        toneMapping: pc.TONEMAP_LINEAR
    });
    camera.setLocalPosition(cameraPos);
    camera.lookAt(focusPos);
    app.root.addChild(camera);

    // Add orbit camera script with native mouse input (LMB orbit, MMB pan, wheel zoom)
    camera.addComponent('script');
    const orbitCamera = camera.script.create('orbitCamera', {
        attributes: {
            frameOnStart: false,
            inertiaFactor: 0.07
        }
    });
    const orbitInput = camera.script.create('orbitCameraInputMouse');

    // Initialize orbit camera to match current camera position and focus
    orbitCamera.resetAndLookAtPoint(cameraPos, focusPos);

    // Paint state
    let isPainting = false;

    // Track if picker needs re-preparation (after camera moves)
    let pickerDirty = true;

    // Disable context menu for RMB
    app.mouse.disableContextMenu();

    // Helper to update paint color on all processors
    const updatePaintColor = () => {
        const color = data.get('paintColor');
        const intensity = data.get('paintIntensity');
        // RGB from color picker, alpha is the intensity
        for (const paintable of paintables) {
            paintable.processor.setParameter('uPaintColor', [color[0], color[1], color[2], intensity]);
        }
    };

    // Set initial paint color
    updatePaintColor();

    // Listen for color/intensity changes
    data.on('paintColor:set', updatePaintColor);
    data.on('paintIntensity:set', updatePaintColor);

    // Create picker for world position (with depth enabled)
    const picker = new pc.Picker(app, 1, 1, true);
    const worldLayer = app.scene.layers.getLayerByName('World');

    // Prepare picker (re-prepare when camera moves)
    const preparePicker = () => {
        if (pickerDirty) {
            picker.resize(canvas.clientWidth, canvas.clientHeight);
            picker.prepare(camera.camera, app.scene, [worldLayer]);
            pickerDirty = false;
        }
    };

    // Pending paint requests - processed in update loop for consistent frame timing
    const pendingPaints = [];

    // Temp vectors for coordinate transformation
    const invMat = new pc.Mat4();
    const modelPoint = new pc.Vec3();

    // Process pending paint requests in update loop
    app.on('update', () => {
        // Process all pending paint requests
        while (pendingPaints.length > 0) {
            const { worldPoint, brushRadius } = pendingPaints.shift();

            // Run all processors - each transforms to its own model space
            for (const paintable of paintables) {
                // Transform world position to this entity's model space
                invMat.copy(paintable.entity.getWorldTransform()).invert();
                invMat.transformPoint(worldPoint, modelPoint);

                // Set paint sphere uniform and run processor
                paintable.processor.setParameter('uPaintSphere', [modelPoint.x, modelPoint.y, modelPoint.z, brushRadius]);
                paintable.processor.process();

                // Trigger work buffer update for next frame to reflect the paint changes
                paintable.entity.gsplat.workBufferUpdate = pc.WORKBUFFER_UPDATE_ONCE;
            }
        }
    });

    // Request paint at a specific screen position - queues for processing in update loop
    const paintAt = (x, y) => {
        // Prepare picker if needed (after camera moved)
        preparePicker();

        // Get world position for the paint brush
        picker.getWorldPointAsync(x, y).then((worldPoint) => {
            if (worldPoint) {
                const brushRadius = data.get('brushSize');

                // Queue paint request for processing in update loop
                pendingPaints.push({ worldPoint: worldPoint.clone(), brushRadius });
            }
        });
    };

    // RMB paint - disable orbit input while painting (orbit-camera handles LMB/MMB/wheel natively)
    app.mouse.on(pc.EVENT_MOUSEDOWN, (e) => {
        if (e.button === pc.MOUSEBUTTON_RIGHT) {
            isPainting = true;
            pickerDirty = true;
            orbitInput.enabled = false;
            orbitInput.panButtonDown = false; // Cancel pan that orbit-camera started
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

    // Cleanup on destroy
    app.on('destroy', () => {
        for (const paintable of paintables) {
            paintable.processor?.destroy();
        }
        picker.destroy();
    });
});

export { app };
