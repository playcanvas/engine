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
 * - Automatic cleanup on input source removal or XR session end, with each model loaded once and
 *   kept for later input sources and sessions until the script is destroyed
 * - Models hidden while their pose is not tracked, such as behind the system menu
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
 * @category XR
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
     * Map of input sources to their controller data (entity, joint mappings, asset, whether its
     * pose is tracked, and the enabled state its entity returns to once tracking resumes). The asset
     * is owned by the script and shared by every input source that uses the same model.
     *
     * @type {Map<XrInputSource, { entity: import('playcanvas').Entity, jointMap: Map, asset: import('playcanvas').Asset<'container'>, tracked: boolean, enabledWhenTracked: boolean }>}
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
     * Model loads by URL, shared by every input source that uses the model. The asset registry
     * hands back one asset per URL, so a model is loaded once and only unloaded when the script is
     * destroyed: unloading it as one input source went away would take it from any other input
     * source using it, or still waiting for it to load.
     *
     * @type {Map<string, { load: Promise<import('playcanvas').Asset<'container'>>, asset: import('playcanvas').Asset<'container'> | null }>}
     * @private
     */
    _models = new Map();

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

        // Release the models now, as an application being destroyed drops its asset registry next,
        // and those still loading once they land
        for (const model of this._models.values()) {
            if (model.asset) {
                this._releaseModel(model.asset);
            } else {
                model.load.then(asset => this._releaseModel(asset), () => {});
            }
        }
        this._models.clear();
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

        // the model asset stays loaded for other input sources and later sessions
        controller.entity.destroy();

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
     * Tries to load profiles sequentially, returning the first successful result.
     *
     * @param {XrInputSource} inputSource - The input source.
     * @param {string[]} profiles - Array of profile IDs to try.
     * @param {number} [index=0] - Current index in the profiles array.
     * @returns {Promise<{ profileId: string, asset: import('playcanvas').Asset<'container'> } | null>} The result or null.
     * @private
     */
    async _tryLoadProfiles(inputSource, profiles, index = 0) {
        if (index >= profiles.length) return null;
        if (!this._pendingInputSources.has(inputSource)) return null;

        const result = await this._loadProfile(inputSource, profiles[index]);
        if (result) return result;

        return this._tryLoadProfiles(inputSource, profiles, index + 1);
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
        const successfulResult = await this._tryLoadProfiles(inputSource, inputSource.profiles);

        // Check if input source was removed during loading. Its model stays loaded, as an input
        // source added since may be using it
        if (!this._pendingInputSources.has(inputSource)) {
            return;
        }

        // Remove from pending set
        this._pendingInputSources.delete(inputSource);

        if (successfulResult) {
            const { asset } = successfulResult;
            // loaded by _loadProfile, so the resource is present
            const container = /** @type {import('playcanvas').ContainerResource} */ (asset.resource);
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

            this.controllers.set(inputSource, { entity, jointMap, asset, tracked: true, enabledWhenTracked: true });

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
     * @returns {Promise<{ profileId: string, asset: import('playcanvas').Asset<'container'> } | null>} The result or null on failure.
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

            // the input source was removed, or the script destroyed, while the profile loaded
            if (!this._pendingInputSources.has(inputSource)) return null;

            const asset = await this._loadModel(assetPath);
            return { profileId, asset };
        } catch (error) {
            // Silently fail for individual profiles - we'll try the next one
            return null;
        }
    }

    /**
     * Loads a model, or returns the load already made for its URL.
     *
     * @param {string} url - The model URL.
     * @returns {Promise<import('playcanvas').Asset<'container'>>} The loaded model asset.
     * @private
     */
    _loadModel(url) {
        const existing = this._models.get(url);
        if (existing) return existing.load;

        const model = {
            load: new Promise((resolve, reject) => {
                this.app.assets.loadFromUrl(url, 'container', (err, asset) => {
                    if (err) reject(err);
                    else resolve(asset);
                });
            }),
            asset: null
        };
        this._models.set(url, model);

        model.load.then((asset) => {
            model.asset = asset;
        }, () => {
            // forget a failed load, so a later input source can try again
            if (this._models.get(url) === model) this._models.delete(url);
        });

        return model.load;
    }

    /**
     * Removes a model from the asset registry and unloads it.
     *
     * @param {import('playcanvas').Asset<'container'>} asset - The model asset.
     * @private
     */
    _releaseModel(asset) {
        // a destroyed application has unloaded its assets and dropped its registry
        const { assets } = this.app;
        if (!assets) return;

        assets.remove(asset);
        asset.unload();
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
     * Sets the visibility state of controller models.
     *
     * @type {boolean}
     */
    set visible(value) {
        if (this._visible === value) return;

        this._visible = value;

        for (const [, controller] of this.controllers) {
            // a model hidden while untracked takes the new state once tracking resumes
            if (controller.tracked) {
                controller.entity.enabled = value;
            } else {
                controller.enabledWhenTracked = value;
            }
        }
    }

    /**
     * Gets the visibility state of controller models.
     *
     * @type {boolean}
     */
    get visible() {
        return this._visible;
    }

    update(dt) {
        if (!this.app.xr?.active || !this._visible) return;

        // While the session is not fully visible, such as behind the system menu, the browser
        // sends no poses, so the models would stay frozen where they were last tracked
        const sessionVisible = this.app.xr.visibilityState === 'visible';

        for (const [inputSource, controller] of this.controllers) {
            // a hand also loses tracking when it leaves the view of the headset. A model hidden
            // while untracked gets back the enabled state it had, so one the app hid stays hidden
            const tracked = sessionVisible && (!inputSource.hand || inputSource.hand.tracking);
            if (controller.tracked !== tracked) {
                controller.tracked = tracked;
                if (tracked) {
                    controller.entity.enabled = controller.enabledWhenTracked;
                } else {
                    controller.enabledWhenTracked = controller.entity.enabled;
                    controller.entity.enabled = false;
                }
            }
            if (!tracked) continue;

            const { entity, jointMap } = controller;

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
