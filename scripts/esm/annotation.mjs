import {
    CULLFACE_NONE,
    FILTER_LINEAR,
    PIXELFORMAT_RGBA8,
    BlendState,
    Color,
    Entity,
    Layer,
    Mesh,
    MeshInstance,
    PlaneGeometry,
    Script,
    StandardMaterial,
    Texture,
    Vec3,
    BLENDEQUATION_ADD,
    BLENDMODE_ONE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_SRC_ALPHA
} from 'playcanvas';

/** @import { Application, CameraComponent, Quat } from 'playcanvas' */

// clamp the vertices of the hotspot so it is never clipped by the near or far plane
const depthClamp = `
    float f = gl_Position.z / gl_Position.w;
    if (f > 1.0) {
        gl_Position.z = gl_Position.w;
    } else if (f < -1.0) {
        gl_Position.z = -gl_Position.w;
    }
`;

const depthClampWGSL = `
    let f: f32 = output.position.z / output.position.w;
    if (f > 1.0) {
        output.position.z = output.position.w;
    } else if (f < -1.0) {
        output.position.z = -output.position.w;
    }
`;

const vec = new Vec3();

/**
 * A script for creating interactive 3D annotations in a scene. Each annotation consists of:
 *
 * - A 3D hotspot that maintains constant screen-space size. The hotspot is rendered with muted
 * appearance when obstructed by geometry but is still clickable. The hotspot relies on an
 * invisible DOM element that matches the hotspot's size and position to detect clicks.
 * - An annotation panel that shows title and description text.
 */
export class Annotation extends Script {
    static scriptName = 'annotation';

    /** @type {number} */
    static hotspotSize = 25;

    /** @type {Color} */
    static hotspotColor = new Color(0.8, 0.8, 0.8);

    /** @type {Color} */
    static hoverColor = new Color(1.0, 0.4, 0.0);

    /** @type {HTMLElement | null} */
    static parentDom = null;

    /** @type {HTMLStyleElement | null} */
    static styleSheet = null;

    /** @type {Entity | null} */
    static camera = null;

    /** @type {HTMLDivElement | null} */
    static tooltipDom = null;

    /** @type {HTMLDivElement | null} */
    static titleDom = null;

    /** @type {HTMLDivElement | null} */
    static textDom = null;

    /** @type {Layer[]} */
    static layers = [];

    /** @type {Mesh | null} */
    static mesh = null;

    /** @type {Annotation | null} */
    static activeAnnotation = null;

    /** @type {Annotation | null} */
    static hoverAnnotation = null;

    /** @type {number} */
    static opacity = 1.0;

    /**
     * @type {string}
     * @attribute
     */
    label;

    /**
     * @type {string}
     * @attribute
     */
    title;

    /**
     * @type {string}
     * @attribute
     */
    text;

    /**
     * @type {HTMLDivElement | null}
     * @private
     */
    hotspotDom = null;

    /**
     * @type {Texture | null}
     * @private
     */
    texture = null;

    /**
     * @type {StandardMaterial[]}
     * @private
     */
    materials = [];

    /**
     * Injects required CSS styles into the document.
     * @param {number} size - The size of the hotspot in screen pixels.
     * @private
     */
    static _injectStyles(size) {
        const css = `
            .pc-annotation {
                display: block;
                position: absolute;
                background-color: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px;
                border-radius: 4px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
                pointer-events: none;
                max-width: 200px;
                word-wrap: break-word;
                overflow-x: visible;
                white-space: normal;
                width: fit-content;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
                visibility: hidden;
                transform: translate(25px, -50%);
            }

            .pc-annotation-title {
                font-weight: bold;
                margin-bottom: 4px;
            }

            /* Add a little triangular arrow on the left edge of the tooltip */
            .pc-annotation::before {
                content: "";
                position: absolute;
                left: -8px;
                top: 50%;
                transform: translateY(-50%);
                width: 0;
                height: 0;
                border-top: 8px solid transparent;
                border-bottom: 8px solid transparent;
                border-right: 8px solid rgba(0, 0, 0, 0.8);
            }

            .pc-annotation-hotspot {
                display: none;
                position: absolute;
                width: ${size + 5}px;
                height: ${size + 5}px;
                opacity: 0;
                cursor: pointer;
                transform: translate(-50%, -50%);
            }
        `;

        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        Annotation.styleSheet = style;
    }

    /**
     * Initialize static resources.
     * @param {Application} app - The application instance
     * @private
     */
    static _initializeStatic(app) {
        if (Annotation.styleSheet) {
            return;
        }

        Annotation._injectStyles(Annotation.hotspotSize);

        if (Annotation.parentDom === null) {
            Annotation.parentDom = document.body;
        }

        const { layers } = app.scene;
        const worldLayer = layers.getLayerByName('World');

        const createLayer = (name, semitrans) => {
            const layer = new Layer({ name: name });
            const idx = semitrans ? layers.getTransparentIndex(worldLayer) : layers.getOpaqueIndex(worldLayer);
            layers.insert(layer, idx + 1);
            return layer;
        };

        Annotation.layers = [
            createLayer('HotspotBase', false),
            createLayer('HotspotOverlay', true)
        ];

        if (Annotation.camera === null) {
            Annotation.camera = app.root.findComponent('camera').entity;
        }

        Annotation.camera.camera.layers = [
            ...Annotation.camera.camera.layers,
            ...Annotation.layers.map(layer => layer.id)
        ];

        Annotation.mesh = Mesh.fromGeometry(app.graphicsDevice, new PlaneGeometry({
            widthSegments: 1,
            lengthSegments: 1
        }));

        // Initialize tooltip dom
        Annotation.tooltipDom = document.createElement('div');
        Annotation.tooltipDom.className = 'pc-annotation';

        Annotation.titleDom = document.createElement('div');
        Annotation.titleDom.className = 'pc-annotation-title';
        Annotation.tooltipDom.appendChild(Annotation.titleDom);

        Annotation.textDom = document.createElement('div');
        Annotation.textDom.className = 'pc-annotation-text';
        Annotation.tooltipDom.appendChild(Annotation.textDom);

        Annotation.parentDom.appendChild(Annotation.tooltipDom);
    }

    /**
     * Creates a circular hotspot texture.
     * @param {Application} app - The PlayCanvas application
     * @param {string} label - Label text to draw on the hotspot
     * @param {number} [size] - The texture size (should be power of 2)
     * @param {number} [borderWidth] - The border width in pixels
     * @returns {Texture} The hotspot texture
     * @private
     */
    static _createHotspotTexture(app, label, size = 64, borderWidth = 6) {
        // Create canvas for hotspot texture
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // First clear with stroke color at zero alpha
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1.0;

        // Draw dark circle with light border
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = (size / 2) - 4; // Leave space for border

        // Draw main circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'black';
        ctx.fill();

        // Draw border
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = 'white';
        ctx.stroke();

        // Draw text
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(label, Math.floor(canvas.width / 2), Math.floor(canvas.height / 2) + 1);

        // get pixel data
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        // set the color channel of semitransparent pixels to white so the blending at
        // the edges is correct
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 255) {
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
            }
        }

        const texture = new Texture(app.graphicsDevice, {
            width: size,
            height: size,
            format: PIXELFORMAT_RGBA8,
            magFilter: FILTER_LINEAR,
            minFilter: FILTER_LINEAR,
            mipmaps: false,
            levels: [new Uint8Array(data.buffer)]
        });

        return texture;
    }

    /**
     * Creates a material for hotspot rendering.
     * @param {Texture} texture - The texture to use for emissive and opacity
     * @param {object} [options] - Material options
     * @param {number} [options.opacity] - Base opacity multiplier
     * @param {boolean} [options.depthTest] - Whether to perform depth testing
     * @param {boolean} [options.depthWrite] - Whether to write to depth buffer
     * @returns {StandardMaterial} The configured material
     * @private
     */
    static _createHotspotMaterial(texture, { opacity = 1, depthTest = true, depthWrite = true } = {}) {
        const material = new StandardMaterial();

        // Base properties
        material.diffuse = Color.BLACK;
        material.emissive.copy(Annotation.hotspotColor);
        material.emissiveMap = texture;
        material.opacityMap = texture;

        // Alpha properties
        material.opacity = opacity;
        material.alphaTest = 0.01;
        material.blendState = new BlendState(
            true,
            BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE
        );

        // Depth properties
        material.depthTest = depthTest;
        material.depthWrite = depthWrite;

        // Rendering properties
        material.cull = CULLFACE_NONE;
        material.useLighting = false;

        material.shaderChunks.glsl.add({
            'litUserMainEndVS': depthClamp
        });

        material.shaderChunks.wgsl.add({
            'litUserMainEndVS': depthClampWGSL
        });

        material.update();
        return material;
    }

    initialize() {
        // Ensure static resources are initialized
        Annotation._initializeStatic(this.app);

        // Create texture
        this.texture = Annotation._createHotspotTexture(this.app, this.label);

        // Create the base and overlay material
        this.materials = [
            Annotation._createHotspotMaterial(this.texture, {
                opacity: 1,
                depthTest: true,
                depthWrite: true
            }),
            Annotation._createHotspotMaterial(this.texture, {
                opacity: 0.25,
                depthTest: false,
                depthWrite: false
            })
        ];

        const base = new Entity('base');
        const baseMi = new MeshInstance(Annotation.mesh, this.materials[0]);
        baseMi.cull = false;
        base.addComponent('render', {
            layers: [Annotation.layers[0].id],
            meshInstances: [baseMi]
        });

        const overlay = new Entity('overlay');
        const overlayMi = new MeshInstance(Annotation.mesh, this.materials[1]);
        overlayMi.cull = false;
        overlay.addComponent('render', {
            layers: [Annotation.layers[1].id],
            meshInstances: [overlayMi]
        });

        this.entity.addChild(base);
        this.entity.addChild(overlay);

        // Create hotspot dom
        this.hotspotDom = document.createElement('div');
        this.hotspotDom.className = 'pc-annotation-hotspot';

        // Add click handlers
        this.hotspotDom.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTooltip();
        });

        const leave = () => {
            if (Annotation.hoverAnnotation === this) {
                Annotation.hoverAnnotation = null;
                this.setHover(false);
            }
        };

        const enter = () => {
            if (Annotation.hoverAnnotation !== null) {
                Annotation.hoverAnnotation.setHover(false);
            }
            Annotation.hoverAnnotation = this;
            this.setHover(true);
        };

        this.hotspotDom.addEventListener('pointerenter', enter);
        this.hotspotDom.addEventListener('pointerleave', leave);

        document.addEventListener('click', () => {
            this.hideTooltip();
        });

        Annotation.parentDom.appendChild(this.hotspotDom);

        // Store prerender handler for cleanup
        const prerenderHandler = () => {
            if (!Annotation.camera) return;

            const position = this.entity.getPosition();
            const screenPos = Annotation.camera.camera.worldToScreen(position);

            const { viewMatrix } = Annotation.camera.camera;
            viewMatrix.transformPoint(position, vec);
            if (vec.z >= 0) {
                this._hideElements();
                return;
            }

            this._updatePositions(screenPos);
            this._updateRotationAndScale();

            // update material opacity and also directly on the uniform so we
            // can avoid a full material update
            this.materials[0].opacity = Annotation.opacity;
            this.materials[1].opacity = 0.25 * Annotation.opacity;
            this.materials[0].setParameter('material_opacity', Annotation.opacity);
            this.materials[1].setParameter('material_opacity', 0.25 * Annotation.opacity);
        };
        this.app.on('prerender', prerenderHandler);

        // Clean up on entity destruction
        this.on('destroy', () => {
            this.hotspotDom.remove();
            if (Annotation.activeAnnotation === this) {
                this.hideTooltip();
            }

            this.materials.forEach(mat => mat.destroy());
            this.materials = [];

            this.texture.destroy();
            this.texture = null;

            // Remove prerender event listener
            this.app.off('prerender', prerenderHandler);
        });
    }

    /**
     * Set the hover state of the annotation.
     * @param {boolean} hover - Whether the annotation is hovered
     * @private
     */
    setHover(hover) {
        this.materials.forEach((material) => {
            material.emissive.copy(hover ? Annotation.hoverColor : Annotation.hotspotColor);
            material.update();
        });
        this.fire('hover', hover);
    }

    /**
     * @private
     */
    showTooltip() {
        Annotation.activeAnnotation = this;
        Annotation.tooltipDom.style.visibility = 'visible';
        Annotation.tooltipDom.style.opacity = '1';
        Annotation.titleDom.textContent = this.title;
        Annotation.textDom.textContent = this.text;
        this.fire('show', this);
    }

    /**
     * @private
     */
    hideTooltip() {
        Annotation.activeAnnotation = null;
        Annotation.tooltipDom.style.opacity = '0';

        // Wait for fade out before hiding
        setTimeout(() => {
            if (Annotation.tooltipDom.style.opacity === '0') {
                Annotation.tooltipDom.style.visibility = 'hidden';
            }
            this.fire('hide');
        }, 200); // Match the transition duration
    }

    /**
     * Hide all elements when annotation is behind camera.
     * @private
     */
    _hideElements() {
        this.hotspotDom.style.display = 'none';
        if (Annotation.activeAnnotation === this) {
            if (Annotation.tooltipDom.style.visibility !== 'hidden') {
                this.hideTooltip();
            }
        }
    }

    /**
     * Update screen-space positions of HTML elements.
     * @param {Vec3} screenPos - Screen coordinate
     * @private
     */
    _updatePositions(screenPos) {
        // Show and position hotspot
        this.hotspotDom.style.display = 'block';
        this.hotspotDom.style.left = `${screenPos.x}px`;
        this.hotspotDom.style.top = `${screenPos.y}px`;

        // Position tooltip
        if (Annotation.activeAnnotation === this) {
            Annotation.tooltipDom.style.left = `${screenPos.x}px`;
            Annotation.tooltipDom.style.top = `${screenPos.y}px`;
        }
    }

    /**
     * Update 3D rotation and scale of hotspot planes.
     * @private
     */
    _updateRotationAndScale() {
        // Copy camera rotation to align with view plane
        const cameraRotation = Annotation.camera.getRotation();
        this._updateHotspotTransform(this.entity, cameraRotation);

        // Calculate scale based on distance to maintain constant screen size
        const scale = this._calculateScreenSpaceScale();
        this.entity.setLocalScale(scale, scale, scale);
    }

    /**
     * Update rotation of a single hotspot entity.
     * @param {Entity} hotspot - The hotspot entity to update
     * @param {Quat} cameraRotation - The camera's current rotation
     * @private
     */
    _updateHotspotTransform(hotspot, cameraRotation) {
        hotspot.setRotation(cameraRotation);
        hotspot.rotateLocal(90, 0, 0);
    }

    /**
     * Calculate scale factor to maintain constant screen-space size.
     * @returns {number} The scale to apply to hotspot entities
     * @private
     */
    _calculateScreenSpaceScale() {
        const cameraPos = Annotation.camera.getPosition();
        const toAnnotation = this.entity.getPosition().clone().sub(cameraPos);
        const distance = toAnnotation.length();

        // Use the canvas's CSS/client height instead of graphics device height
        const canvas = this.app.graphicsDevice.canvas;
        const screenHeight = canvas.clientHeight;

        // Get the camera's projection matrix vertical scale factor
        const projMatrix = Annotation.camera.camera.projectionMatrix;
        const worldSize = (Annotation.hotspotSize / screenHeight) * (2 * distance / projMatrix.data[5]);

        return worldSize;
    }
}
