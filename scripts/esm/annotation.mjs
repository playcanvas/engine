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

/** @import { EventHandle } from 'playcanvas' */

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
 * Resources managed by the AnnotationManager for each Annotation instance.
 * @typedef {object} AnnotationResources
 * @property {Entity} baseEntity - The entity for the main hotspot mesh
 * @property {Entity} overlayEntity - The entity for the overlay mesh (behind geometry)
 * @property {HTMLDivElement} hotspotDom - The clickable DOM element for the hotspot
 * @property {Texture} texture - The hotspot texture with the label
 * @property {StandardMaterial[]} materials - The materials for base and overlay
 * @property {EventHandle[]} eventHandles - Event listener handles for cleanup
 * @property {Function} domCleanup - Function to remove DOM event listeners
 */

/**
 * A manager script that handles global configuration and shared resources for all annotations
 * in a scene. Add this script to a single entity to configure annotation appearance.
 *
 * The manager listens for app-level events to automatically register annotations:
 * - `annotation:add` - fired when an Annotation script initializes
 * - `annotation:remove` - fired when an Annotation script is destroyed
 *
 * The manager handles:
 * - Global hotspot size, colors, and opacity settings (configurable in Editor)
 * - Shared rendering resources (layers, mesh)
 * - Per-annotation rendering resources (entities, materials, DOM elements)
 * - Tooltip DOM elements
 * - Hover and click interactions
 */
export class AnnotationManager extends Script {
    static scriptName = 'annotationManager';

    /** @private */
    _hotspotSize = 25;

    /** @private */
    _hotspotColor = new Color(0.8, 0.8, 0.8);

    /** @private */
    _hoverColor = new Color(1.0, 0.4, 0.0);

    /** @private */
    _opacity = 1.0;

    /** @private */
    _behindOpacity = 0.25;

    /**
     * The size of hotspots in screen pixels.
     *
     * @attribute
     * @title Hotspot Size
     * @type {number}
     * @default 25
     */
    set hotspotSize(value) {
        if (this._hotspotSize === value) return;
        this._hotspotSize = value;
        this._updateStyleSheet();
    }

    get hotspotSize() {
        return this._hotspotSize;
    }

    /**
     * The default color of hotspots.
     *
     * @attribute
     * @title Hotspot Color
     * @type {Color}
     * @default [0.8, 0.8, 0.8, 1]
     */
    set hotspotColor(value) {
        if (this._hotspotColor.equals(value)) return;
        this._hotspotColor.copy(value);
        this._updateAllAnnotationColors();
    }

    get hotspotColor() {
        return this._hotspotColor;
    }

    /**
     * The color of hotspots when hovered.
     *
     * @attribute
     * @title Hotspot Hover Color
     * @type {Color}
     * @default [1, 0.4, 0, 1]
     */
    set hoverColor(value) {
        if (this._hoverColor.equals(value)) return;
        this._hoverColor.copy(value);
        // Update currently hovered annotation if any
        if (this._hoverAnnotation) {
            this._setAnnotationHover(this._hoverAnnotation, true);
        }
    }

    get hoverColor() {
        return this._hoverColor;
    }

    /**
     * The opacity of hotspots when visible (not occluded).
     *
     * @attribute
     * @title Hotspot Opacity
     * @type {number}
     * @range [0, 1]
     * @default 1
     */
    set opacity(value) {
        this._opacity = value;
    }

    get opacity() {
        return this._opacity;
    }

    /**
     * The opacity of hotspots when behind geometry.
     *
     * @attribute
     * @title Hotspot Behind Opacity
     * @type {number}
     * @range [0, 1]
     * @default 0.25
     */
    set behindOpacity(value) {
        this._behindOpacity = value;
    }

    get behindOpacity() {
        return this._behindOpacity;
    }

    // Shared resources

    /**
     * @type {HTMLStyleElement | null}
     * @private
     */
    _styleSheet = null;

    /**
     * @type {HTMLElement | null}
     * @private
     */
    _parentDom = null;

    /**
     * @type {Entity | null}
     * @private
     */
    _camera = null;

    /**
     * @type {HTMLDivElement | null}
     * @private
     */
    _tooltipDom = null;

    /**
     * @type {HTMLDivElement | null}
     * @private
     */
    _titleDom = null;

    /**
     * @type {HTMLDivElement | null}
     * @private
     */
    _textDom = null;

    /**
     * @type {Layer[]}
     * @private
     */
    _layers = [];

    /**
     * @type {Mesh | null}
     * @private
     */
    _mesh = null;

    // Per-annotation resources

    /**
     * Map of Annotation instances to their rendering resources.
     * @type {Map<Annotation, AnnotationResources>}
     * @private
     */
    _annotationResources = new Map();

    /**
     * @type {Annotation | null}
     * @private
     */
    _activeAnnotation = null;

    /**
     * @type {Annotation | null}
     * @private
     */
    _hoverAnnotation = null;

    /**
     * Injects required CSS styles into the document.
     * @private
     */
    _injectStyles() {
        const size = this._hotspotSize;
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
        this._styleSheet = style;
    }

    /**
     * Updates the stylesheet when hotspot size changes.
     * @private
     */
    _updateStyleSheet() {
        if (this._styleSheet) {
            this._styleSheet.remove();
            this._styleSheet = null;
        }
        this._injectStyles();
    }

    /**
     * Updates all annotation materials when hotspot color changes.
     * @private
     */
    _updateAllAnnotationColors() {
        for (const [annotation, resources] of this._annotationResources) {
            // Only update non-hovered annotations
            if (annotation !== this._hoverAnnotation) {
                resources.materials.forEach((material) => {
                    material.emissive.copy(this._hotspotColor);
                    material.update();
                });
            }
        }
    }

    /**
     * Creates a circular hotspot texture.
     * @param {string} label - Label text to draw on the hotspot
     * @param {number} [size] - The texture size (should be power of 2)
     * @param {number} [borderWidth] - The border width in pixels
     * @returns {Texture} The hotspot texture
     * @private
     */
    _createHotspotTexture(label, size = 64, borderWidth = 6) {
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
        const radius = (size / 2) - 4;

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

        return new Texture(this.app.graphicsDevice, {
            width: size,
            height: size,
            format: PIXELFORMAT_RGBA8,
            magFilter: FILTER_LINEAR,
            minFilter: FILTER_LINEAR,
            mipmaps: false,
            levels: [new Uint8Array(data.buffer)]
        });
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
    _createHotspotMaterial(texture, { opacity = 1, depthTest = true, depthWrite = true } = {}) {
        const material = new StandardMaterial();

        material.diffuse = Color.BLACK;
        material.emissive.copy(this._hotspotColor);
        material.emissiveMap = texture;
        material.opacityMap = texture;

        material.opacity = opacity;
        material.alphaTest = 0.01;
        material.blendState = new BlendState(
            true,
            BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE
        );

        material.depthTest = depthTest;
        material.depthWrite = depthWrite;
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

    /**
     * Sets the hover state visual for an annotation.
     * @param {Annotation} annotation - The annotation
     * @param {boolean} hover - Whether hovered
     * @private
     */
    _setAnnotationHover(annotation, hover) {
        const resources = this._annotationResources.get(annotation);
        if (!resources) return;

        resources.materials.forEach((material) => {
            material.emissive.copy(hover ? this._hoverColor : this._hotspotColor);
            material.update();
        });
        annotation.fire('hover', hover);
    }

    /**
     * Shows the tooltip for an annotation.
     * @param {Annotation} annotation - The annotation to show tooltip for
     * @private
     */
    _showTooltip(annotation) {
        this._activeAnnotation = annotation;
        this._tooltipDom.style.visibility = 'visible';
        this._tooltipDom.style.opacity = '1';
        this._titleDom.textContent = annotation.title;
        this._textDom.textContent = annotation.text;
        annotation.fire('show', annotation);
    }

    /**
     * Hides the tooltip.
     * @param {Annotation} annotation - The annotation that was active
     * @private
     */
    _hideTooltip(annotation) {
        this._activeAnnotation = null;
        this._tooltipDom.style.opacity = '0';

        // Wait for fade out before hiding
        setTimeout(() => {
            if (this._tooltipDom && this._activeAnnotation === null) {
                this._tooltipDom.style.visibility = 'hidden';
            }
            annotation.fire('hide');
        }, 200);
    }

    /**
     * Hides all elements when annotation is behind camera.
     * @param {Annotation} annotation - The annotation
     * @param {AnnotationResources} resources - The annotation's resources
     * @private
     */
    _hideAnnotationElements(annotation, resources) {
        resources.hotspotDom.style.display = 'none';
        if (this._activeAnnotation === annotation) {
            if (this._tooltipDom.style.visibility !== 'hidden') {
                this._hideTooltip(annotation);
            }
        }
    }

    /**
     * Updates screen-space positions of HTML elements.
     * @param {Annotation} annotation - The annotation
     * @param {AnnotationResources} resources - The annotation's resources
     * @param {Vec3} screenPos - Screen coordinate
     * @private
     */
    _updateAnnotationPositions(annotation, resources, screenPos) {
        resources.hotspotDom.style.display = 'block';
        resources.hotspotDom.style.left = `${screenPos.x}px`;
        resources.hotspotDom.style.top = `${screenPos.y}px`;

        if (this._activeAnnotation === annotation) {
            this._tooltipDom.style.left = `${screenPos.x}px`;
            this._tooltipDom.style.top = `${screenPos.y}px`;
        }
    }

    /**
     * Updates 3D rotation and scale of hotspot planes.
     * @param {Annotation} annotation - The annotation
     * @private
     */
    _updateAnnotationRotationAndScale(annotation) {
        const cameraRotation = this._camera.getRotation();
        annotation.entity.setRotation(cameraRotation);
        annotation.entity.rotateLocal(90, 0, 0);

        const cameraPos = this._camera.getPosition();
        const distance = annotation.entity.getPosition().distance(cameraPos);
        const canvas = this.app.graphicsDevice.canvas;
        const screenHeight = canvas.clientHeight;
        const projMatrix = this._camera.camera.projectionMatrix;
        const worldSize = (this._hotspotSize / screenHeight) * (2 * distance / projMatrix.data[5]);

        annotation.entity.setLocalScale(worldSize, worldSize, worldSize);
    }

    /**
     * Handles label change for an annotation.
     * @param {Annotation} annotation - The annotation
     * @param {string} label - The new label
     * @private
     */
    _onLabelChange(annotation, label) {
        const resources = this._annotationResources.get(annotation);
        if (!resources) return;

        // Destroy old texture
        resources.texture.destroy();

        // Create new texture
        resources.texture = this._createHotspotTexture(label);

        // Update materials
        resources.materials.forEach((material) => {
            material.emissiveMap = resources.texture;
            material.opacityMap = resources.texture;
            material.update();
        });
    }

    /**
     * Handles title change for an annotation.
     * @param {Annotation} annotation - The annotation
     * @param {string} title - The new title
     * @private
     */
    _onTitleChange(annotation, title) {
        if (this._activeAnnotation === annotation) {
            this._titleDom.textContent = title;
        }
    }

    /**
     * Handles text change for an annotation.
     * @param {Annotation} annotation - The annotation
     * @param {string} text - The new text
     * @private
     */
    _onTextChange(annotation, text) {
        if (this._activeAnnotation === annotation) {
            this._textDom.textContent = text;
        }
    }

    /**
     * Handles enable event for an annotation.
     * @param {Annotation} annotation - The annotation
     * @private
     */
    _onAnnotationEnable(annotation) {
        const resources = this._annotationResources.get(annotation);
        if (!resources) return;

        resources.baseEntity.enabled = true;
        resources.overlayEntity.enabled = true;
        resources.hotspotDom.style.display = '';
    }

    /**
     * Handles disable event for an annotation.
     * @param {Annotation} annotation - The annotation
     * @private
     */
    _onAnnotationDisable(annotation) {
        const resources = this._annotationResources.get(annotation);
        if (!resources) return;

        resources.baseEntity.enabled = false;
        resources.overlayEntity.enabled = false;
        resources.hotspotDom.style.display = 'none';

        if (this._activeAnnotation === annotation) {
            this._hideTooltip(annotation);
        }
        if (this._hoverAnnotation === annotation) {
            this._hoverAnnotation = null;
            this._setAnnotationHover(annotation, false);
        }
    }

    /**
     * Registers an annotation and creates its rendering resources.
     * Called automatically when an `annotation:add` event is received.
     * @param {Annotation} annotation - The annotation to register
     * @private
     */
    _registerAnnotation(annotation) {
        if (this._annotationResources.has(annotation)) {
            return;
        }

        const eventHandles = [];

        // Create texture
        const texture = this._createHotspotTexture(annotation.label);

        // Create materials
        const materials = [
            this._createHotspotMaterial(texture, {
                opacity: 1,
                depthTest: true,
                depthWrite: true
            }),
            this._createHotspotMaterial(texture, {
                opacity: this._behindOpacity,
                depthTest: false,
                depthWrite: false
            })
        ];

        // Create base entity
        const baseEntity = new Entity('base');
        const baseMi = new MeshInstance(this._mesh, materials[0]);
        baseMi.cull = false;
        baseEntity.addComponent('render', {
            layers: [this._layers[0].id],
            meshInstances: [baseMi]
        });

        // Create overlay entity
        const overlayEntity = new Entity('overlay');
        const overlayMi = new MeshInstance(this._mesh, materials[1]);
        overlayMi.cull = false;
        overlayEntity.addComponent('render', {
            layers: [this._layers[1].id],
            meshInstances: [overlayMi]
        });

        annotation.entity.addChild(baseEntity);
        annotation.entity.addChild(overlayEntity);

        // Create hotspot DOM
        const hotspotDom = document.createElement('div');
        hotspotDom.className = 'pc-annotation-hotspot';

        // Click handler
        const onPointerDown = (e) => {
            e.stopPropagation();
            if (this._activeAnnotation === annotation) {
                this._hideTooltip(annotation);
            } else {
                this._showTooltip(annotation);
            }
        };
        hotspotDom.addEventListener('pointerdown', onPointerDown);

        // Hover handlers
        const onPointerEnter = () => {
            if (this._hoverAnnotation !== null) {
                this._setAnnotationHover(this._hoverAnnotation, false);
            }
            this._hoverAnnotation = annotation;
            this._setAnnotationHover(annotation, true);
        };

        const onPointerLeave = () => {
            if (this._hoverAnnotation === annotation) {
                this._hoverAnnotation = null;
                this._setAnnotationHover(annotation, false);
            }
        };

        hotspotDom.addEventListener('pointerenter', onPointerEnter);
        hotspotDom.addEventListener('pointerleave', onPointerLeave);

        // Wheel passthrough
        const onWheel = (e) => {
            const canvas = this.app.graphicsDevice.canvas;
            canvas.dispatchEvent(new WheelEvent(e.type, e));
        };
        hotspotDom.addEventListener('wheel', onWheel);

        this._parentDom.appendChild(hotspotDom);

        // Listen for annotation attribute changes
        eventHandles.push(annotation.on('label:set', label => this._onLabelChange(annotation, label)));
        eventHandles.push(annotation.on('title:set', title => this._onTitleChange(annotation, title)));
        eventHandles.push(annotation.on('text:set', text => this._onTextChange(annotation, text)));
        eventHandles.push(annotation.on('enable', () => this._onAnnotationEnable(annotation)));
        eventHandles.push(annotation.on('disable', () => this._onAnnotationDisable(annotation)));

        // Store cleanup function for DOM listeners
        const domCleanup = () => {
            hotspotDom.removeEventListener('pointerdown', onPointerDown);
            hotspotDom.removeEventListener('pointerenter', onPointerEnter);
            hotspotDom.removeEventListener('pointerleave', onPointerLeave);
            hotspotDom.removeEventListener('wheel', onWheel);
        };

        // Store resources
        /** @type {AnnotationResources} */
        const resources = {
            baseEntity,
            overlayEntity,
            hotspotDom,
            texture,
            materials,
            eventHandles,
            domCleanup
        };

        this._annotationResources.set(annotation, resources);
    }

    /**
     * Unregisters an annotation and destroys its rendering resources.
     * Called automatically when an `annotation:remove` event is received.
     * @param {Annotation} annotation - The annotation to unregister
     * @private
     */
    _unregisterAnnotation(annotation) {
        const resources = this._annotationResources.get(annotation);
        if (!resources) return;

        // Clear active/hover state
        if (this._activeAnnotation === annotation) {
            this._activeAnnotation = null;
            this._tooltipDom.style.visibility = 'hidden';
        }
        if (this._hoverAnnotation === annotation) {
            this._hoverAnnotation = null;
        }

        // Unbind event handles
        resources.eventHandles.forEach(handle => handle.unbind());
        resources.eventHandles.length = 0;

        // Remove DOM listeners
        resources.domCleanup();

        // Remove DOM element
        resources.hotspotDom.remove();

        // Destroy entities
        resources.baseEntity.destroy();
        resources.overlayEntity.destroy();

        // Destroy materials
        resources.materials.forEach(mat => mat.destroy());
        resources.materials.length = 0;

        // Destroy texture
        resources.texture.destroy();

        this._annotationResources.delete(annotation);
    }

    initialize() {
        // Set parent DOM
        if (this._parentDom === null) {
            this._parentDom = document.body;
        }

        // Inject styles
        this._injectStyles();

        // Create layers
        const { layers } = this.app.scene;
        const worldLayer = layers.getLayerByName('World');

        const createLayer = (name, semitrans) => {
            const layer = new Layer({ name });
            const idx = semitrans ? layers.getTransparentIndex(worldLayer) : layers.getOpaqueIndex(worldLayer);
            layers.insert(layer, idx + 1);
            return layer;
        };

        this._layers = [
            createLayer('HotspotBase', false),
            createLayer('HotspotOverlay', true)
        ];

        // Find camera if not set
        if (this._camera === null) {
            const cameraComponent = this.app.root.findComponent('camera');
            if (cameraComponent) {
                this._camera = cameraComponent.entity;
            }
        }

        // Add layers to camera
        if (this._camera) {
            this._camera.camera.layers = [
                ...this._camera.camera.layers,
                ...this._layers.map(layer => layer.id)
            ];
        }

        // Create shared mesh
        this._mesh = Mesh.fromGeometry(this.app.graphicsDevice, new PlaneGeometry({
            widthSegments: 1,
            lengthSegments: 1
        }));

        // Initialize tooltip DOM
        this._tooltipDom = document.createElement('div');
        this._tooltipDom.className = 'pc-annotation';

        this._titleDom = document.createElement('div');
        this._titleDom.className = 'pc-annotation-title';
        this._tooltipDom.appendChild(this._titleDom);

        this._textDom = document.createElement('div');
        this._textDom.className = 'pc-annotation-text';
        this._tooltipDom.appendChild(this._textDom);

        this._parentDom.appendChild(this._tooltipDom);

        // Single document-level listener to dismiss active tooltip
        const onDocumentPointerDown = () => {
            if (this._activeAnnotation) {
                this._hideTooltip(this._activeAnnotation);
            }
        };
        document.addEventListener('pointerdown', onDocumentPointerDown);

        // Listen for annotation add/remove events on the app
        const onAnnotationAdd = annotation => this._registerAnnotation(annotation);
        const onAnnotationRemove = annotation => this._unregisterAnnotation(annotation);

        this.app.on('annotation:add', onAnnotationAdd);
        this.app.on('annotation:remove', onAnnotationRemove);

        // Prerender handler - update all annotations
        const prerenderHandler = () => {
            if (!this._camera) return;

            for (const [annotation, resources] of this._annotationResources) {
                if (!annotation.enabled) continue;

                const position = annotation.entity.getPosition();
                const screenPos = this._camera.camera.worldToScreen(position);

                const { viewMatrix } = this._camera.camera;
                viewMatrix.transformPoint(position, vec);
                if (vec.z >= 0) {
                    this._hideAnnotationElements(annotation, resources);
                    continue;
                }

                this._updateAnnotationPositions(annotation, resources, screenPos);
                this._updateAnnotationRotationAndScale(annotation);

                // Update material opacity
                resources.materials[0].opacity = this._opacity;
                resources.materials[1].opacity = this._behindOpacity * this._opacity;
                resources.materials[0].setParameter('material_opacity', this._opacity);
                resources.materials[1].setParameter('material_opacity', this._behindOpacity * this._opacity);
            }
        };
        this.app.on('prerender', prerenderHandler);

        // Clean up on destroy
        this.once('destroy', () => {
            // Unregister all annotations
            for (const annotation of this._annotationResources.keys()) {
                this._unregisterAnnotation(annotation);
            }

            // Remove event listeners
            this.app.off('annotation:add', onAnnotationAdd);
            this.app.off('annotation:remove', onAnnotationRemove);
            this.app.off('prerender', prerenderHandler);
            document.removeEventListener('pointerdown', onDocumentPointerDown);

            // Remove DOM elements
            if (this._tooltipDom) {
                this._tooltipDom.remove();
                this._tooltipDom = null;
            }
            if (this._styleSheet) {
                this._styleSheet.remove();
                this._styleSheet = null;
            }

            // Remove layers from camera
            if (this._camera && this._camera.camera) {
                const layerIds = this._layers.map(layer => layer.id);
                this._camera.camera.layers = this._camera.camera.layers.filter(
                    id => !layerIds.includes(id)
                );
            }

            // Remove layers from scene
            const { layers } = this.app.scene;
            this._layers.forEach(layer => layers.remove(layer));
            this._layers = [];

            // Destroy mesh
            if (this._mesh) {
                this._mesh.destroy();
                this._mesh = null;
            }
        });
    }
}

/**
 * A lightweight data script for creating interactive 3D annotations in a scene.
 * This script only holds the annotation data (label, title, text) - all rendering
 * and interaction is handled by an AnnotationManager listening for app events.
 *
 * Fires the following app-level events:
 * - `annotation:add` - when the annotation initializes
 * - `annotation:remove` - when the annotation is destroyed
 *
 * Fires the following script-level events (listened to by AnnotationManager):
 * - `label:set` - when label changes
 * - `title:set` - when title changes
 * - `text:set` - when text changes
 * - `hover` - when hover state changes
 * - `show` - when tooltip is shown
 * - `hide` - when tooltip is hidden
 */
export class Annotation extends Script {
    static scriptName = 'annotation';

    /** @private */
    _label = '';

    /** @private */
    _title = '';

    /** @private */
    _text = '';

    /**
     * The short text displayed on the hotspot circle (e.g. "1", "A").
     *
     * @attribute
     * @title Label
     * @type {string}
     */
    set label(value) {
        this._label = value;
        this.fire('label:set', value);
    }

    get label() {
        return this._label;
    }

    /**
     * The title shown in the tooltip when the hotspot is clicked.
     *
     * @attribute
     * @title Title
     * @type {string}
     */
    set title(value) {
        this._title = value;
        this.fire('title:set', value);
    }

    get title() {
        return this._title;
    }

    /**
     * The description text shown in the tooltip when the hotspot is clicked.
     *
     * @attribute
     * @title Text
     * @type {string}
     */
    set text(value) {
        this._text = value;
        this.fire('text:set', value);
    }

    get text() {
        return this._text;
    }

    /**
     * Called after all scripts have initialized, ensuring the AnnotationManager
     * is ready to receive the annotation:add event.
     */
    postInitialize() {
        // Notify any listeners that this annotation has been created
        this.app.fire('annotation:add', this);

        // Clean up on destroy
        this.once('destroy', () => {
            this.app.fire('annotation:remove', this);
        });
    }
}
