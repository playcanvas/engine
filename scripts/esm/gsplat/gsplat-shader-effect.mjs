import { Script } from 'playcanvas';

/**
 * Base class for gsplat shader effects.
 * Handles common functionality like material management, shader application,
 * time tracking, and uniform updates.
 *
 * **Usage:**
 * Attach this script to an entity with a gsplat component. The script automatically detects
 * whether the gsplat is in unified or non-unified mode and handles material access accordingly.
 *
 * **Non-Unified Mode (`unified=false`):**
 * Each gsplat component has its own material. The script accesses the material directly via
 * `entity.gsplat.material` and applies shader customizations immediately or when the asset loads.
 *
 * **Unified Mode (`unified=true`):**
 * Multiple gsplat components share materials per camera/layer combination. Materials are created
 * during the first frame render. The script listens to the 'material:created' event for immediate
 * notification and retries each frame as fallback to ensure materials are applied.
 *
 * **Enable/Disable:**
 * When enabled, the shader effect is applied and effectTime starts tracking from 0.
 * When disabled, the custom shader is removed and materials revert to default rendering.
 *
 * Subclasses must implement:
 * - getShaderGLSL(): Return GLSL shader string
 * - getShaderWGSL(): Return WGSL shader string
 * - updateEffect(effectTime, dt): Update effect each frame
 *
 * @abstract
 */
class GsplatShaderEffect extends Script {
    static scriptName = 'gsplatShaderEffect';

    /**
     * Optional camera entity to target in unified mode. If not set, applies to all cameras.
     *
     * @attribute
     * @type {import('playcanvas').Entity | null}
     */
    camera = null;

    /**
     * Time since effect was enabled
     * @type {number}
     */
    effectTime = 0;

    /**
     * Set of materials with applied shader
     * @type {Set<import('playcanvas').Material>}
     */
    materialsApplied = new Set();

    initialize() {
        this.initialized = false;
        this.effectTime = 0;
        this.materialsApplied.clear();
        this.shadersNeedApplication = false;

        // Listen to enable/disable events
        this.on('enable', () => {
            // Reset effect time when enabling
            this.effectTime = 0;

            // Ensure we're initialized
            if (!this.initialized && this.entity.gsplat) {
                this.initialized = true;
            }

            // Apply shaders if initialized, otherwise flag for application
            if (this.initialized) {
                this.applyShaders();
            } else {
                this.shadersNeedApplication = true;
            }
        });

        this.on('disable', () => {
            // Remove shaders when disabling
            this.removeShaders();
        });

        // Register event listener immediately for unified mode to catch materials created on first frame
        // This is safe to call even if the gsplat component doesn't exist yet
        this.setupUnifiedEventListener();

        if (!this.entity.gsplat) {
            // gsplat component not yet available, will retry each frame
            return;
        }

        this.initialized = true;

        // Apply shaders immediately since we're enabled by default
        if (this.enabled) {
            this.applyShaders();
        }
    }

    applyShaders() {
        if (this.entity.gsplat?.unified) {
            // Unified mode: Apply to specified camera (or all cameras if not specified)
            this.applyToUnifiedMaterials();
        } else {
            // Non-unified mode: Apply to component's material
            this.applyToComponentMaterial();
        }
    }

    removeShaders() {
        if (this.materialsApplied.size === 0) return;

        const device = this.app.graphicsDevice;
        const shaderLanguage = device?.isWebGPU ? 'wgsl' : 'glsl';

        // Remove custom shader chunk from all materials
        this.materialsApplied.forEach((material) => {
            material.getShaderChunks(shaderLanguage).delete('gsplatCustomizeVS');
            material.update();
        });

        // Clear the set and stop tracking
        this.materialsApplied.clear();
    }

    setupUnifiedEventListener() {
        // Only set up once
        if (this._materialCreatedHandler) return;

        // @ts-ignore - gsplat system exists at runtime
        const gsplatSystem = this.app.systems.gsplat;

        // Set up event listener
        this._materialCreatedHandler = (material, camera, layer) => {
            // Only apply if enabled
            if (!this.enabled) return;

            // Apply shader immediately when material is created
            // The gsplat component may not be fully initialized yet, so we can't check it here
            if (!this.materialsApplied.has(material)) {
                // Check camera filter if specified
                if (this.camera && this.camera.camera && this.camera.camera.camera !== camera) {
                    return;
                }

                this.applyShaderToMaterial(material);
                this.materialsApplied.add(material);

                // Store layer info for potential validation later
                if (!this._materialLayers) {
                    this._materialLayers = new Map();
                }
                this._materialLayers.set(material, layer.id);
            }
        };

        gsplatSystem.on('material:created', this._materialCreatedHandler);
    }

    applyToComponentMaterial() {
        const applyShader = () => {
            const material = this.entity.gsplat?.material;
            if (!material) {
                console.error(`${this.constructor.name}: gsplat material not available.`);
                return;
            }
            this.applyShaderToMaterial(material);
        };

        if (this.entity.gsplat?.material) {
            applyShader();
        } else {
            // Listen for when the gsplat component is ready
            this.entity.gsplat?.once('load', applyShader);
        }
    }

    applyToUnifiedMaterials() {
        // Try to apply immediately to any existing materials
        this.updateUnifiedMaterials();

        // If no materials yet, set retry flag (event listener is already set up)
        if (this.materialsApplied.size === 0) {
            this.needsRetry = true;
        }
    }

    updateUnifiedMaterials() {
        // @ts-ignore - gsplat system exists at runtime
        const gsplatSystem = this.app.systems.gsplat;
        const scene = this.app.scene;
        const composition = scene.layers;

        // Get all layers this component is on
        const componentLayers = this.entity.gsplat?.layers;
        if (!componentLayers) return;

        // Determine which cameras to target
        let targetCameras;
        const cam = this.camera?.camera?.camera;
        if (cam) {
            // Specific camera specified via attribute
            targetCameras = [cam];
        } else {
            // All cameras in the composition
            targetCameras = composition.cameras.map(cameraComponent => cameraComponent.camera);
        }

        // Iterate through target cameras (already Camera objects, not CameraComponents)
        targetCameras.forEach((camera) => {
            // For each layer this component is on
            componentLayers.forEach((layerId) => {
                // Check if this camera renders this layer
                if (camera.layers.indexOf(layerId) >= 0) {
                    const layer = composition.getLayerById(layerId);
                    if (layer) {
                        const material = gsplatSystem.getGSplatMaterial(camera, layer);
                        if (material && !this.materialsApplied.has(material)) {
                            this.applyShaderToMaterial(material);
                            this.materialsApplied.add(material);
                        }
                    }
                }
            });
        });

        if (this.materialsApplied.size > 0) {
            this.needsRetry = false;
            // Keep event listener active to catch any new materials created later
        }
    }

    applyShaderToMaterial(material) {
        const device = this.app.graphicsDevice;
        const shaderLanguage = device?.isWebGPU ? 'wgsl' : 'glsl';
        const customShader = shaderLanguage === 'wgsl' ? this.getShaderWGSL() : this.getShaderGLSL();

        material.getShaderChunks(shaderLanguage).set('gsplatCustomizeVS', customShader);
        material.update();
    }

    update(dt) {
        // If not initialized, try to complete initialization
        if (!this.initialized) {
            if (this.entity.gsplat) {
                this.initialized = true;
                // Apply shaders now if we're enabled and they're needed
                if (this.enabled && this.shadersNeedApplication) {
                    this.applyShaders();
                    this.shadersNeedApplication = false;
                }
            }
            return; // Don't proceed with updates until initialized
        }

        // Apply shaders if they're needed (can happen if enabled after initialization)
        if (this.shadersNeedApplication) {
            this.applyShaders();
            this.shadersNeedApplication = false;
        }

        // Retry applying to unified materials if needed
        if (this.entity.gsplat?.unified && this.needsRetry) {
            this.updateUnifiedMaterials();
        }

        if (this.materialsApplied.size === 0) return;

        // Update time
        this.effectTime += dt;

        // Let subclass update the effect
        this.updateEffect(this.effectTime, dt);
    }

    destroy() {
        // Remove shaders if they're still applied
        this.removeShaders();

        // Clean up event listener
        if (this._materialCreatedHandler) {
            // @ts-ignore - gsplat system exists at runtime
            this.app.systems.gsplat.off('material:created', this._materialCreatedHandler);
            this._materialCreatedHandler = null;
        }
    }

    /**
     * Get the GLSL shader string.
     * Must be implemented by subclasses.
     * @returns {string} GLSL shader code
     * @abstract
     */
    getShaderGLSL() {
        throw new Error(`${this.constructor.name} must implement getShaderGLSL()`);
    }

    /**
     * Get the WGSL shader string.
     * Must be implemented by subclasses.
     * @returns {string} WGSL shader code
     * @abstract
     */
    getShaderWGSL() {
        throw new Error(`${this.constructor.name} must implement getShaderWGSL()`);
    }

    /**
     * Set a uniform value on all applied materials.
     * @param {string} name - The uniform name
     * @param {*} value - The uniform value
     */
    setUniform(name, value) {
        this.materialsApplied.forEach((material) => {
            material.setParameter(name, value);
        });
    }

    /**
     * Update effect each frame.
     * Must be implemented by subclasses if they need to update uniforms or check completion.
     * @param {number} effectTime - Time since effect was enabled in seconds
     * @param {number} dt - Delta time in seconds
     * @abstract
     */
    updateEffect(effectTime, dt) {
        // Optional to override
    }
}

export { GsplatShaderEffect };
