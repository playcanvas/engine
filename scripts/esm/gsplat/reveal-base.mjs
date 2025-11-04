import { Script } from 'playcanvas';

/**
 * Base class for gsplat reveal effects.
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
 * **Effect Completion:**
 * When the effect completes (determined by `isEffectComplete()`), the custom shader is removed
 * and materials revert to default rendering for better performance. Subclasses should override
 * `isEffectComplete()` to define when their effect is done.
 *
 * Subclasses must implement:
 * - getShaderGLSL(): Return GLSL shader string
 * - getShaderWGSL(): Return WGSL shader string
 * - getUniforms(): Return object with uniform names and default values
 * - updateUniforms(dt): Update uniform values each frame
 *
 * Subclasses should override:
 * - isEffectComplete(): Return true when effect should revert to default rendering
 *
 * @abstract
 */
class GsplatRevealBase extends Script {
    static scriptName = 'gsplatRevealBase';

    /**
     * Optional camera entity to target in unified mode. If not set, applies to all cameras.
     *
     * @attribute
     * @type {Entity}
     */
    camera;

    initialize() {
        this.initialized = false;
        this.currentTime = 0;
        this.uTime = null;
        this.uniforms = {};
        this.materialsApplied = new Set();

        // Register event listener immediately for unified mode to catch materials created on first frame
        // This is safe to call even if the gsplat component doesn't exist yet
        this.setupUnifiedEventListener();

        if (!this.entity.gsplat) {
            // gsplat component not yet available, will retry each frame
            return;
        }

        this.completeInitialization();
    }

    completeInitialization() {
        if (this.entity.gsplat.unified) {
            // Unified mode: Apply to specified camera (or all cameras if not specified)
            this.applyToUnifiedMaterials();
        } else {
            // Non-unified mode: Apply to component's material
            this.applyToComponentMaterial();
        }

        this.initialized = true;
    }

    setupUnifiedEventListener() {
        // Only set up once
        if (this._materialCreatedHandler) return;

        const gsplatSystem = this.app.systems.gsplat;

        // Set up event listener
        this._materialCreatedHandler = (material, camera, layer) => {
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

        if (this.entity.gsplat.material) {
            applyShader();
        } else {
            // Listen for when the gsplat component is ready
            this.entity.gsplat.once('load', applyShader);
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
        const gsplatSystem = this.app.systems.gsplat;
        const scene = this.app.scene;
        const composition = scene.layers;

        // Get all layers this component is on
        const componentLayers = this.entity.gsplat.layers;

        // Determine which cameras to target
        let targetCameras;
        if (this.camera && this.camera.camera) {
            // Specific camera specified via attribute
            targetCameras = [this.camera.camera];
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

        // Resolve uniforms on first material application
        if (!this.uTime) {
            this.uTime = device.scope.resolve('uTime');
            const uniformDefs = this.getUniforms();
            for (const name of Object.keys(uniformDefs)) {
                this.uniforms[name] = device.scope.resolve(name);
            }

            // Initialize uniforms with default values
            this.uTime.setValue(0);
            for (const [name, defaultValue] of Object.entries(uniformDefs)) {
                this.uniforms[name].setValue(defaultValue);
            }

            // Apply initial attribute values
            this.updateUniforms(0);
        }
    }

    update(dt) {
        // If not initialized, try to complete initialization
        if (!this.initialized) {
            if (this.entity.gsplat) {
                this.completeInitialization();
            }
            return; // Don't proceed with updates until initialized
        }

        // Check if effect is complete
        if (this.isEffectComplete() && this.materialsApplied.size > 0) {
            this.revertMaterials();
            return; // Stop updating after reverting
        }

        // Retry applying to unified materials if needed
        if (this.entity.gsplat?.unified && this.needsRetry) {
            this.updateUnifiedMaterials();
        }

        if (!this.uTime) return;

        // Update time
        this.currentTime += dt;
        this.uTime.setValue(this.currentTime);

        // Let subclass update its uniforms
        this.updateUniforms(dt);
    }

    /**
     * Removes the shader customization from all materials, reverting to default rendering.
     * This should be called when the effect is complete.
     */
    revertMaterials() {
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

    /**
     * Override in subclass to determine when effect is complete.
     * @returns {boolean} True if effect should be disabled
     */
    isEffectComplete() {
        return false; // Subclasses should override
    }

    destroy() {
        // Clean up event listener
        if (this._materialCreatedHandler) {
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
     * Get uniform definitions.
     * Must be implemented by subclasses.
     * @returns {Object<string, any>} Map of uniform names to default values
     * @abstract
     */
    getUniforms() {
        return {};
    }

    /**
     * Update uniform values each frame.
     * Must be implemented by subclasses if they have uniforms to update.
     * @param {number} dt - Delta time in seconds
     * @abstract
     */
    updateUniforms(dt) {
        // Optional to override
    }
}

export { GsplatRevealBase };
