// @config DESCRIPTION <div style="color:black">3D product configurator with an HTML UI panel rendered as a WebGL texture via <b>HTML-in-Canvas</b> API. Uses <code>getElementTransform</code> for interactive hit testing — clicks and hovers on the 3D panel are handled by the browser's native DOM event system.<br><b>Click</b> to switch shoe material variants.</div>
//
// This example demonstrates a 3D product configurator where an interactive HTML
// panel (styled with CSS glassmorphism) is rendered as a WebGL texture on a 3D
// plane next to a shoe model with glTF KHR_materials_variants. The HtmlSync
// class keeps the DOM element's CSS transform in sync with the 3D projection so
// the browser can hit-test clicks and hovers on the HTML buttons.
//
// Fallback: when device.supportsHtmlTextures is false, the HTML panel is shown
// as a fixed DOM overlay on top of the canvas instead of a 3D textured plane.
// Click handling works identically in both modes via standard DOM events.
//
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { BlurredPlanarReflection } = await fileImport(`${rootPath}/static/scripts/esm/blurred-planar-reflection.mjs`);

// ---------------------------------------------------------------------------
// HtmlSync — self-contained helper class for HTML-in-Canvas hit testing.
// Copy this class into any PlayCanvas project that uses the HTML-in-Canvas
// proposal (layoutsubtree + getElementTransform) to render interactive HTML
// elements on 3D plane entities.
//
// Usage:
//   const sync = new HtmlSync(canvas, htmlElement, planeEntity, width, height);
//   // every frame:
//   sync.update(cameraComponent);
// ---------------------------------------------------------------------------
class HtmlSync {
    /**
     * @param {HTMLCanvasElement} canvas - The canvas with layoutsubtree="true".
     * @param {HTMLElement} element - The HTML element appended to the canvas.
     * @param {pc.Entity} planeEntity - The plane entity displaying the texture.
     * @param {number} width - HTML element width in CSS pixels.
     * @param {number} height - HTML element height in CSS pixels.
     */
    constructor(canvas, element, planeEntity, width, height) {
        this.canvas = canvas;
        this.element = element;
        this.planeEntity = planeEntity;

        // pixelToLocal maps HTML pixel coords (0..width, 0..height) to the
        // PlayCanvas plane's local space (-0.5..0.5). Column 2 provides a
        // non-zero Z axis (the plane's normal) so the matrix stays
        // non-singular — the browser needs to invert it for hit testing.
        this._pixelToLocal = new pc.Mat4();
        this._pixelToLocal.data.set([
            1 / width, 0, 0, 0,
            0, 0, 1 / height, 0,
            0, 1, 0, 0,
            -0.5, 0, -0.5, 1
        ]);

        this._t1 = new pc.Mat4();
        this._t2 = new pc.Mat4();
        this._drawTransform = new pc.Mat4();
    }

    /**
     * Recompute the draw_transform and sync the element's CSS transform so the
     * browser can hit-test it at the correct screen position.
     *
     * @param {pc.CameraComponent} cameraComponent - The active camera component.
     */
    update(cameraComponent) {
        const canvas = this.canvas;
        const w = canvas.width;
        const h = canvas.height;

        // world · pixelToLocal
        this._t1.mul2(this.planeEntity.getWorldTransform(), this._pixelToLocal);
        // projection · view
        this._t2.mul2(cameraComponent.projectionMatrix, cameraComponent.viewMatrix);
        // viewProj · world · pixelToLocal
        this._drawTransform.mul2(this._t2, this._t1);

        // viewport: clip-space → device pixels (Y flipped)
        this._t1.data.set([
            w / 2, 0, 0, 0,
            0, -h / 2, 0, 0,
            0, 0, 1, 0,
            w / 2, h / 2, 0, 1
        ]);
        // viewport · viewProj · world · pixelToLocal  (_t2 receives the result)
        this._t2.mul2(this._t1, this._drawTransform);

        const d = this._t2.data;
        const domDrawTransform = new DOMMatrix([
            d[0], d[1], d[2], d[3],
            d[4], d[5], d[6], d[7],
            d[8], d[9], d[10], d[11],
            d[12], d[13], d[14], d[15]
        ]);

        // Register the element for hit testing via the browser API.
        /** @type {any} */ (canvas).getElementTransform(this.element, domDrawTransform);

        // Apply the CSS transform ourselves. The browser's internal S^-1·T·S
        // formula doesn't handle perspective projections correctly — it scales
        // the w row via S, distorting the perspective divide for non-origin
        // points. The fix: scale only the output x,y rows by 1/DPR.
        const dpr = w / canvas.clientWidth;
        this.element.style.transform = new DOMMatrix([
            d[0] / dpr, d[1] / dpr, d[2], d[3],
            d[4] / dpr, d[5] / dpr, d[6], d[7],
            d[8] / dpr, d[9] / dpr, d[10], d[11],
            d[12] / dpr, d[13] / dpr, d[14], d[15]
        ]).toString();
    }
}

// Enable HTML-in-Canvas: the "layoutsubtree" attribute tells the browser to
// composite any child HTML elements into the canvas, making them available as
// texture sources and enabling hit testing through getElementTransform.
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
canvas.setAttribute('layoutsubtree', 'true');
window.focus();

const assets = {
    envatlas: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    shoe: new pc.Asset('shoe', 'container', { url: `${rootPath}/static/assets/models/MaterialsVariantsShoe.glb` }),
    background: new pc.Asset('background', 'texture', { url: `${rootPath}/static/assets/textures/background_shoes.png` }, { srgb: true })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.ScriptComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ScriptHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('paint', onPaintUpload);
    if (htmlPanel.parentNode) htmlPanel.parentNode.removeChild(htmlPanel);
});

// --- HTML UI Panel ---
// The UI panel is a regular HTML <div> styled with CSS. When HTML-in-Canvas is
// supported it gets appended to the canvas (so it's composited into the WebGL
// surface and can be used as a texture). Otherwise it falls back to a fixed DOM
// overlay on top of the canvas.
const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 380;

let variants = ['Beach', 'Midnight', 'Street'];
let activeVariant = '';

// Color swatches for each shoe variant, displayed as conic gradients
const variantColors = {
    beach: ['#e8a0b0', '#d4828f', '#f0c0c8'],
    midnight: ['#2196c8', '#1565a0', '#4fc3f7'],
    street: ['#2a2a2a', '#e94560', '#1a1a1a']
};

// Check if the device can use HTML elements as texture sources (HTML-in-Canvas API)
const supportsHtmlInCanvas = device.supportsHtmlTextures;

const htmlPanel = document.createElement('div');
htmlPanel.style.width = `${PANEL_WIDTH}px`;
htmlPanel.style.height = `${PANEL_HEIGHT}px`;
htmlPanel.style.padding = '20px';
htmlPanel.style.background = 'rgba(15, 15, 25, 0.375)';
htmlPanel.style.backdropFilter = 'blur(12px)';
htmlPanel.style.webkitBackdropFilter = 'blur(12px)';
htmlPanel.style.borderRadius = '20px';
htmlPanel.style.fontFamily = "'Segoe UI', Arial, sans-serif";
htmlPanel.style.color = 'white';
htmlPanel.style.display = 'flex';
htmlPanel.style.flexDirection = 'column';
htmlPanel.style.gap = '14px';
htmlPanel.style.boxSizing = 'border-box';
htmlPanel.style.border = '1px solid rgba(255,255,255,0.18)';
htmlPanel.style.boxShadow = '0 8px 40px rgba(0,0,0,0.25)';

if (supportsHtmlInCanvas) {
    // Positioned at (0,0) with top-left origin — the HtmlSync class will
    // override the CSS transform each frame to project it onto the 3D plane.
    htmlPanel.style.position = 'absolute';
    htmlPanel.style.left = '0';
    htmlPanel.style.top = '0';
    htmlPanel.style.transformOrigin = '0 0';
} else {
    // Fallback: render as a standard DOM overlay when HTML-in-Canvas is
    // not available. The panel remains interactive via normal DOM events.
    htmlPanel.style.position = 'fixed';
    htmlPanel.style.right = '40px';
    htmlPanel.style.top = '50%';
    htmlPanel.style.transform = 'translateY(-50%)';
    htmlPanel.style.zIndex = '100';
}

const updatePanel = () => {
    htmlPanel.innerHTML = `
        <style>
            .variant-btn { transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s; }
            .variant-btn:hover:not(.active) {
                background: rgba(255,255,255,0.12) !important;
                border-color: rgba(255,255,255,0.25) !important;
                color: rgba(255,255,255,0.95) !important;
            }
            .variant-btn:hover:not(.active) .swatch {
                box-shadow: 0 0 0 2px rgba(255,255,255,0.4) !important;
            }
        </style>
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: rgba(255,255,255,0.5); margin-bottom: 2px;">Product Configurator</div>
        <div style="font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Shoe Style</div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.45); margin-bottom: 8px;">Click to change variant</div>
        ${variants.map(v => `
            <div data-variant="${v}" class="variant-btn${v === activeVariant ? ' active' : ''}" style="
                padding: 14px 16px;
                border-radius: 12px;
                background: ${v === activeVariant ? 'rgba(233,69,96,0.15)' : 'rgba(255,255,255,0.06)'};
                border: 1px solid ${v === activeVariant ? 'rgba(233,69,96,0.6)' : 'rgba(255,255,255,0.1)'};
                ${v === activeVariant ? 'box-shadow: 0 0 12px rgba(233,69,96,0.2), inset 0 0 12px rgba(233,69,96,0.05);' : ''}
                font-size: 15px;
                font-weight: ${v === activeVariant ? '600' : '400'};
                color: ${v === activeVariant ? '#ff7b93' : 'rgba(255,255,255,0.7)'};
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 12px;
            ">
                <div class="swatch" style="
                    width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
                    background: conic-gradient(${(variantColors[v.toLowerCase()] || ['#888', '#aaa', '#ccc']).join(', ')});
                    border: 2px solid ${v === activeVariant ? 'rgba(233,69,96,0.8)' : 'rgba(255,255,255,0.2)'};
                    ${v === activeVariant ? 'box-shadow: 0 0 8px rgba(233,69,96,0.5);' : ''}
                    pointer-events: none;
                    transition: border-color 0.15s, box-shadow 0.15s;
                "></div>
                ${v.charAt(0).toUpperCase() + v.slice(1)}
            </div>
        `).join('')}
        <div style="margin-top: auto; font-size: 10px; color: rgba(255,255,255,0.3); text-align: center; letter-spacing: 1px;">
            Powered by HTML-in-Canvas
        </div>
    `;
};
updatePanel();

// --- HTML-to-WebGL texture pipeline ---
// When HTML-in-Canvas is available, the HTML panel is appended as a child of
// the canvas and captured into a WebGL texture via texElementImage2D. The
// browser fires a "paint" event whenever the panel's visual content changes;
// we respond by re-uploading the texture. The first paint uses setSource() to
// bind the element, subsequent paints just call upload().
/** @type {pc.Texture|null} */
let panelTexture = null;

const onPaintUpload = () => {
    if (!app.graphicsDevice || !panelTexture) return;
    panelTexture.upload();
};

if (supportsHtmlInCanvas) {
    canvas.appendChild(htmlPanel);

    panelTexture = new pc.Texture(device, {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        format: pc.PIXELFORMAT_RGBA8,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        name: 'panelTexture'
    });

    canvas.addEventListener('paint', () => {
        panelTexture.setSource(/** @type {any} */ (htmlPanel));
    }, { once: true });
    canvas.requestPaint();
    canvas.addEventListener('paint', onPaintUpload);
} else {
    document.body.appendChild(htmlPanel);
}

// --- Load assets and build scene ---
const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Environment lighting (skybox excluded from camera so background stays white)
    app.scene.envAtlas = assets.envatlas.resource;
    app.scene.skyboxIntensity = 2;

    // Layers setup for reflective ground
    const worldLayer = app.scene.layers.getLayerByName('World');
    const uiLayer = app.scene.layers.getLayerByName('UI');
    const depthLayer = app.scene.layers.getLayerById(pc.LAYERID_DEPTH);

    const excludedLayer = new pc.Layer({ name: 'Excluded' });
    app.scene.layers.insertOpaque(excludedLayer, app.scene.layers.getOpaqueIndex(worldLayer) + 1);
    app.scene.layers.insertTransparent(excludedLayer, app.scene.layers.getTransparentIndex(worldLayer) + 1);

    // Background plane behind the scene
    const bgMaterial = new pc.StandardMaterial();
    bgMaterial.diffuse = new pc.Color(0, 0, 0);
    bgMaterial.emissiveMap = assets.background.resource;
    bgMaterial.emissive = pc.Color.WHITE;
    bgMaterial.useLighting = false;
    bgMaterial.update();

    const bgPlane = new pc.Entity('background');
    bgPlane.addComponent('render', {
        type: 'plane',
        material: bgMaterial
    });
    bgPlane.setLocalPosition(2.2, 2.5, -8);
    bgPlane.setLocalEulerAngles(90, 0, 0);
    bgPlane.setLocalScale(30, 1, 30);
    app.root.addChild(bgPlane);

    // Shoe model
    const shoeEntity = assets.shoe.resource.instantiateRenderEntity();
    shoeEntity.setLocalScale(3, 3, 3);
    shoeEntity.setLocalEulerAngles(0, 0, -20);
    shoeEntity.setLocalPosition(0, 1.7, 0);
    app.root.addChild(shoeEntity);

    // Read variant names from the model
    const modelVariants = assets.shoe.resource.getMaterialVariants();
    if (modelVariants.length > 0) {
        variants = modelVariants;
    }
    activeVariant = variants[0];
    updatePanel();

    // 3D panel entity — a plane textured with the live HTML panel texture.
    // It uses emissive rendering (unlit) with premultiplied alpha blending so
    // the glassmorphism transparency from CSS is preserved in 3D.
    let panel = null;
    if (panelTexture) {
        const panelMaterial = new pc.StandardMaterial();
        panelMaterial.diffuse = new pc.Color(0, 0, 0);
        panelMaterial.emissiveMap = panelTexture;
        panelMaterial.emissive = pc.Color.WHITE;
        panelMaterial.useLighting = false;
        panelMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        panelMaterial.opacityMap = panelTexture;
        panelMaterial.opacityMapChannel = 'a';
        panelMaterial.alphaTest = 0.1;
        panelMaterial.depthWrite = true;
        panelMaterial.update();

        panel = new pc.Entity('ui-panel');
        panel.addComponent('render', {
            type: 'plane',
            material: panelMaterial
        });
        panel.setLocalPosition(4.5, 2.5, 0);
        panel.setLocalEulerAngles(90, 0, 0);
        panel.setLocalScale(2.8, 1, 3.8);
        app.root.addChild(panel);
    }

    // Reflective ground plane (in excluded layer so it doesn't render into its own reflection)
    const groundReflector = new pc.Entity('ground');
    groundReflector.addComponent('render', {
        type: 'plane',
        layers: [excludedLayer.id],
        castShadows: false
    });
    groundReflector.setLocalPosition(0, -0.5, 0);
    groundReflector.setLocalScale(20, 1, 20);

    groundReflector.addComponent('script');
    /** @type {BlurredPlanarReflection} */
    const reflectionScript = groundReflector.script.create(BlurredPlanarReflection);
    reflectionScript.resolution = 1.0;
    reflectionScript.blurAmount = 0.3;
    reflectionScript.intensity = 1.5;
    reflectionScript.fadeStrength = 0.4;
    reflectionScript.angleFade = 0.3;
    reflectionScript.heightRange = 0.15;
    reflectionScript.fadeColor = new pc.Color(1, 1, 1, 1);

    app.root.addChild(groundReflector);

    // Camera - exclude skybox layer, include depth layer for reflection
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1, 1),
        fov: 45,
        nearClip: 0.01,
        layers: [worldLayer.id, excludedLayer.id, depthLayer.id, uiLayer.id],
        toneMapping: pc.TONEMAP_LINEAR
    });
    camera.setPosition(2.5, 3.0, 14);
    camera.lookAt(2.2, 1.5, 0);

    app.root.addChild(camera);

    // Subtle camera sway — orbit around the look target at constant distance
    const lookTarget = new pc.Vec3(2.2, 1.5, 0);
    const baseDir = camera.getPosition().clone().sub(lookTarget);
    const baseDist = baseDir.length();
    const baseYaw = Math.atan2(baseDir.x, baseDir.z);
    const basePitch = Math.asin(baseDir.y / baseDist);
    let targetYaw = 0;
    let targetPitch = 0;
    let currentYaw = 0;
    let currentPitch = 0;
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        targetYaw = -nx * 0.45;
        targetPitch = ny * 0.15;
    });

    // Set the main camera for the reflection script
    reflectionScript.mainCamera = camera;

    // Light
    const light = new pc.Entity('light');
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        intensity: 3,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shadowResolution: 2048
    });
    light.setEulerAngles(45, 30, 0);
    app.root.addChild(light);

    // Click handling — the HTML panel receives real DOM click events in both
    // modes: via getElementTransform hit testing (HTML-in-Canvas) or via
    // standard DOM events (overlay fallback). When a variant button is clicked
    // we apply the glTF KHR_materials_variants extension and repaint.
    htmlPanel.addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('[data-variant]');
        if (!btn) return;
        const variant = btn.getAttribute('data-variant');
        if (variant && variant !== activeVariant) {
            activeVariant = variant;
            assets.shoe.resource.applyMaterialVariant(shoeEntity, activeVariant);
            updatePanel();
            if (supportsHtmlInCanvas) {
                canvas.requestPaint();
            }
        }
    });

    // Per-frame sync: HtmlSync projects the 3D panel position into screen
    // space and sets the HTML element's CSS transform so the browser's hit
    // testing aligns with where the panel appears in the 3D scene.
    const supportsGetElementTransform = typeof canvas.getElementTransform === 'function';
    const htmlSync = (panel && supportsGetElementTransform) ?
        new HtmlSync(canvas, htmlPanel, panel, PANEL_WIDTH, PANEL_HEIGHT) : null;

    app.on('update', (/** @type {number} */ dt) => {
        // Smooth camera sway — orbit at constant radius
        currentYaw += (targetYaw - currentYaw) * 2 * dt;
        currentPitch += (targetPitch - currentPitch) * 2 * dt;

        const yaw = baseYaw + currentYaw;
        const pitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, basePitch + currentPitch));

        camera.setPosition(
            lookTarget.x + Math.sin(yaw) * Math.cos(pitch) * baseDist,
            lookTarget.y + Math.sin(pitch) * baseDist,
            lookTarget.z + Math.cos(yaw) * Math.cos(pitch) * baseDist
        );
        camera.lookAt(lookTarget);

        htmlSync?.update(camera.camera);
    });
});

export { app };
