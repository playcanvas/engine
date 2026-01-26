import { Script } from 'playcanvas';

/** @import { XrInputSource } from 'playcanvas' */

/**
 * Automatically loads and displays WebXR controller models (hands or gamepads) based on the
 * WebXR Input Profiles specification. The script fetches controller models from the WebXR
 * Input Profiles asset repository and updates their transforms each frame to match the
 * tracked input sources.
 *
 * Features:
 * - Automatic controller model loading from WebXR Input Profiles repository
 * - Support for both hand tracking and gamepad controllers
 * - Automatic cleanup on input source removal or XR session end
 * - Visibility control for integration with other XR scripts
 * - Fires events for controller lifecycle coordination
 *
 * This script should be attached to a parent entity (typically the same entity as XrSession).
 * Use it in conjunction with the `XrNavigation` and `XrMenu` scripts.
 *
 * @example
 * // Add to camera parent entity
 * cameraParent.addComponent('script');
 * cameraParent.script.create(XrControllers, {
 *     properties: {
 *         basePath: 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets/dist/profiles'
 *     }
 * });
 */
class XrControllers extends Script {
    static scriptName = 'xrControllers';

    /**
     * The base URL for fetching the WebXR input profiles.
     *
     * @attribute
     * @type {string}
     */
    basePath = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets/dist/profiles';

    /**
     * Map of input sources to their controller data (entity, joint mappings, and asset).
     *
     * @type {Map<XrInputSource, { entity: import('playcanvas').Entity, jointMap: Map, asset: import('playcanvas').Asset }>}
     */
    controllers = new Map();

    /**
     * Set of input sources currently being loaded (to handle race conditions).
     *
     * @type {Set<XrInputSource>}
     * @private
     */
    _pendingInputSources = new Set();

    /**
     * Whether controller models are currently visible.
     *
     * @type {boolean}
     * @private
     */
    _visible = true;

    /**
     * Bound event handlers for proper cleanup.
     *
     * @type {{ onAdd: (inputSource: XrInputSource) => void, onRemove: (inputSource: XrInputSource) => void, onXrEnd: () => void } | null}
     * @private
     */
    _handlers = null;

    initialize() {
        if (!this.app.xr) {
            console.error('XrControllers script requires XR to be enabled on the application');
            return;
        }

        // Create bound handlers for proper cleanup
        this._handlers = {
            onAdd: this._onInputSourceAdd.bind(this),
            onRemove: this._onInputSourceRemove.bind(this),
            onXrEnd: this._onXrEnd.bind(this)
        };

        // Listen for input source changes
        this.app.xr.input.on('add', this._handlers.onAdd);
        this.app.xr.input.on('remove', this._handlers.onRemove);

        // Listen for XR session end to clean up all controllers
        this.app.xr.on('end', this._handlers.onXrEnd);

        // Clean up on script destroy
        this.once('destroy', () => {
            this._onDestroy();
        });
    }

    /**
     * Cleans up all resources when the script is destroyed.
     *
     * @private
     */
    _onDestroy() {
        if (this._handlers && this.app.xr) {
            this.app.xr.input.off('add', this._handlers.onAdd);
            this.app.xr.input.off('remove', this._handlers.onRemove);
            this.app.xr.off('end', this._handlers.onXrEnd);
        }

        // Destroy all controller entities
        this._destroyAllControllers();

        this._handlers = null;
        this._pendingInputSources.clear();
    }

    /**
     * Handles XR session end by cleaning up all controllers.
     *
     * @private
     */
    _onXrEnd() {
        this._destroyAllControllers();
        this._pendingInputSources.clear();
    }

    /**
     * Destroys a single controller and its associated resources.
     *
     * @param {XrInputSource} inputSource - The input source to destroy.
     * @private
     */
    _destroyController(inputSource) {
        const controller = this.controllers.get(inputSource);
        if (!controller) return;

        controller.entity.destroy();

        if (controller.asset) {
            this.app.assets.remove(controller.asset);
            controller.asset.unload();
        }

        this.controllers.delete(inputSource);
        this.app.fire('xr:controller:remove', inputSource);
    }

    /**
     * Destroys all controller entities and clears the map.
     *
     * @private
     */
    _destroyAllControllers() {
        for (const inputSource of this.controllers.keys()) {
            this._destroyController(inputSource);
        }
    }

    /**
     * Called when an input source is added.
     *
     * @param {XrInputSource} inputSource - The input source that was added.
     * @private
     */
    async _onInputSourceAdd(inputSource) {
        if (!inputSource.profiles?.length) {
            console.warn('XrControllers: No profiles available for input source');
            return;
        }

        // Track this input source as pending to handle race conditions
        this._pendingInputSources.add(inputSource);

        // Load profiles sequentially and stop on first success
        let successfulResult = null;

        for (const profileId of inputSource.profiles) {
            // Check if input source was removed during loading
            if (!this._pendingInputSources.has(inputSource)) {
                return;
            }

            const result = await this._loadProfile(inputSource, profileId);
            if (result) {
                successfulResult = result;
                break;
            }
        }

        // Check again if input source was removed during loading
        if (!this._pendingInputSources.has(inputSource)) {
            // Clean up the loaded asset if we got one
            if (successfulResult?.asset) {
                this.app.assets.remove(successfulResult.asset);
                successfulResult.asset.unload();
            }
            return;
        }

        // Remove from pending set
        this._pendingInputSources.delete(inputSource);

        if (successfulResult) {
            const { asset } = successfulResult;
            const container = asset.resource;
            const entity = container.instantiateRenderEntity();
            this.app.root.addChild(entity);

            // Apply current visibility state
            entity.enabled = this._visible;

            // Build joint map for hand tracking
            const jointMap = new Map();
            if (inputSource.hand) {
                for (const joint of inputSource.hand.joints) {
                    const jointEntity = entity.findByName(joint.id);
                    if (jointEntity) {
                        jointMap.set(joint, jointEntity);
                    }
                }
            }

            this.controllers.set(inputSource, { entity, jointMap, asset });

            // Fire event for other scripts to coordinate
            this.app.fire('xr:controller:add', inputSource, entity);
        } else {
            console.warn('XrControllers: No compatible profiles found for input source');
        }
    }

    /**
     * Loads a single profile and its model.
     *
     * @param {XrInputSource} inputSource - The input source.
     * @param {string} profileId - The profile ID to load.
     * @returns {Promise<{ profileId: string, asset: import('playcanvas').Asset } | null>} The result or null on failure.
     * @private
     */
    async _loadProfile(inputSource, profileId) {
        const profileUrl = `${this.basePath}/${profileId}/profile.json`;

        try {
            const response = await fetch(profileUrl);
            if (!response.ok) {
                return null;
            }

            const profile = await response.json();
            const layoutPath = profile.layouts[inputSource.handedness]?.assetPath || '';
            const assetPath = `${this.basePath}/${profile.profileId}/${inputSource.handedness}${layoutPath.replace(/^\/?(left|right)/, '')}`;

            // Load the model
            const asset = await new Promise((resolve, reject) => {
                this.app.assets.loadFromUrl(assetPath, 'container', (err, asset) => {
                    if (err) reject(err);
                    else resolve(asset);
                });
            });

            return { profileId, asset };
        } catch (error) {
            // Silently fail for individual profiles - we'll try the next one
            return null;
        }
    }

    /**
     * Called when an input source is removed.
     *
     * @param {XrInputSource} inputSource - The input source that was removed.
     * @private
     */
    _onInputSourceRemove(inputSource) {
        // Remove from pending set if still loading
        this._pendingInputSources.delete(inputSource);
        this._destroyController(inputSource);
    }

    /**
     * Gets the visibility state of controller models.
     *
     * @type {boolean}
     */
    get visible() {
        return this._visible;
    }

    /**
     * Sets the visibility state of controller models.
     *
     * @type {boolean}
     */
    set visible(value) {
        if (this._visible === value) return;

        this._visible = value;

        for (const [, controller] of this.controllers) {
            controller.entity.enabled = value;
        }
    }

    update(dt) {
        if (!this.app.xr?.active || !this._visible) return;

        for (const [inputSource, { entity, jointMap }] of this.controllers) {
            if (inputSource.hand) {
                // Update hand joint positions
                for (const [joint, jointEntity] of jointMap) {
                    jointEntity.setPosition(joint.getPosition());
                    jointEntity.setRotation(joint.getRotation());
                }
            } else {
                // Update controller position
                const position = inputSource.getPosition();
                const rotation = inputSource.getRotation();
                if (position) entity.setPosition(position);
                if (rotation) entity.setRotation(rotation);
            }
        }
    }
}

export { XrControllers };
