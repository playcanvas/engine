import { Debug } from '../../../core/debug.js';
import { AnimClip } from '../../anim/evaluator/anim-clip.js';
import { AnimEvaluator } from '../../anim/evaluator/anim-evaluator.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { DefaultAnimBinder } from '../../anim/binder/default-anim-binder.js';
import { Skeleton } from '../../../scene/animation/skeleton.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

/**
 * @import { Animation } from '../../../scene/animation/animation.js'
 * @import { Model } from '../../../scene/model.js'
 */

/**
 * The AnimationComponent enables an {@link Entity} to play back skeletal animations on a model.
 * It is a legacy component that has largely been superseded by {@link AnimComponent}, which
 * supports more advanced features such as animation state graphs and blending.
 *
 * You should never need to use the AnimationComponent constructor directly. To add an
 * AnimationComponent to an {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * const entity = new Entity();
 * entity.addComponent('animation', {
 *     assets: [animationAsset.id],
 *     speed: 1
 * });
 * ```
 *
 * Once the AnimationComponent is added to the entity, you can access it via the
 * {@link Entity#animation} property:
 *
 * ```javascript
 * entity.animation.speed = 2; // Play the animation at double speed
 *
 * console.log(entity.animation.speed); // Get the playback speed and print it
 * ```
 *
 * @hideconstructor
 * @category Animation
 */
class AnimationComponent extends Component {
    /**
     * @type {Object<string, Animation>}
     * @private
     */
    _animations = {};

    /**
     * @type {Array.<number|Asset>}
     * @private
     */
    _assets = [];

    /** @private */
    _loop = true;

    /**
     * @type {AnimEvaluator|null}
     * @ignore
     */
    animEvaluator = null;

    /**
     * @type {Model|null}
     * @ignore
     */
    model = null;

    /**
     * Get the skeleton for the current model. If the model is loaded from glTF/glb, then the
     * skeleton is null.
     *
     * @type {Skeleton|null}
     */
    skeleton = null;

    /**
     * @type {Skeleton|null}
     * @ignore
     */
    fromSkel = null;

    /**
     * @type {Skeleton|null}
     * @ignore
     */
    toSkel = null;

    /**
     * @type {Object<string, string>}
     * @ignore
     */
    animationsIndex = {};

    /**
     * The animation assets this component is subscribed to. Tracked so that the subscriptions can
     * be removed even when the asset is no longer in the asset registry.
     *
     * @type {Set<Asset>}
     * @private
     */
    _boundAssets = new Set();

    /**
     * The names of the asset registry 'add:[id]' events this component is subscribed to, waiting
     * for its animation assets to be added to the registry.
     *
     * @type {Set<string>}
     * @private
     */
    _pendingAssetAdds = new Set();

    /**
     * @type {string|null}
     * @private
     */
    prevAnim = null;

    /**
     * @type {string|null}
     * @private
     */
    currAnim = null;

    /** @private */
    blend = 0;

    /** @private */
    blending = false;

    /** @private */
    blendSpeed = 0;

    /**
     * If true, the first animation asset will begin playing when the scene is loaded.
     */
    activate = true;

    /**
     * Speed multiplier for animation play back. 1 is playback at normal speed and 0 pauses the
     * animation.
     */
    speed = 1;

    /**
     * Sets the dictionary of animations by name.
     *
     * @type {Object<string, Animation>}
     */
    set animations(value) {
        this._animations = value;

        this.onSetAnimations();
    }

    /**
     * Gets the dictionary of animations by name.
     *
     * @type {Object<string, Animation>}
     */
    get animations() {
        return this._animations;
    }

    /**
     * Sets the array of animation assets or asset ids.
     *
     * @type {Array.<number|Asset>}
     */
    set assets(value) {
        const assets = this._assets;

        // unsubscribe from the events of the old assets
        this._unbindAssets();

        if (assets && assets.length) {
            for (let i = 0; i < assets.length; i++) {
                // remove the animations of the old assets
                if (assets[i]) {
                    const id = (assets[i] instanceof Asset) ? assets[i].id : assets[i];
                    const asset = this.system.app.assets.get(id);
                    if (asset) {
                        const animName = this.animationsIndex[asset.id];

                        if (this.currAnim === animName) {
                            this._stopCurrentAnimation();
                        }

                        delete this.animations[animName];
                        delete this.animationsIndex[asset.id];
                    }
                }
            }
        }

        this._assets = value;

        const assetIds = value.map((value) => {
            return (value instanceof Asset) ? value.id : value;
        });

        this.loadAnimationAssets(assetIds);
    }

    /**
     * Gets the array of animation assets or asset ids.
     *
     * @type {Array.<number|Asset>}
     */
    get assets() {
        return this._assets;
    }

    /**
     * Sets the current time position (in seconds) of the animation.
     *
     * @type {number}
     */
    set currentTime(currentTime) {
        if (this.skeleton) {
            this.skeleton.currentTime = currentTime;
            this.skeleton.addTime(0);
            this.skeleton.updateGraph();
        }

        if (this.animEvaluator) {
            const clips = this.animEvaluator.clips;
            for (let i = 0; i < clips.length; ++i) {
                clips[i].time = currentTime;
            }
        }
    }

    /**
     * Gets the current time position (in seconds) of the animation.
     *
     * @type {number}
     */
    get currentTime() {
        if (this.skeleton) {
            return this.skeleton._time;
        }

        if (this.animEvaluator) {
            // Get the last clip's current time which will be the one
            // that is currently being blended
            const clips = this.animEvaluator.clips;
            if (clips.length > 0) {
                return clips[clips.length - 1].time;
            }
        }

        return 0;
    }

    /**
     * Gets the duration in seconds of the current animation. Returns 0 if no animation is playing.
     *
     * @type {number}
     */
    get duration() {
        if (this.currAnim) {
            return this.animations[this.currAnim].duration;
        }

        Debug.warn('No animation is playing to get a duration. Returning 0.');
        return 0;
    }

    /**
     * Sets whether the animation will restart from the beginning when it reaches the end.
     *
     * @type {boolean}
     */
    set loop(value) {
        this._loop = value;

        if (this.skeleton) {
            this.skeleton.looping = value;
        }

        if (this.animEvaluator) {
            for (let i = 0; i < this.animEvaluator.clips.length; ++i) {
                this.animEvaluator.clips[i].loop = value;
            }
        }
    }

    /**
     * Gets whether the animation will restart from the beginning when it reaches the end.
     *
     * @type {boolean}
     */
    get loop() {
        return this._loop;
    }

    /**
     * Start playing an animation.
     *
     * @param {string} name - The name of the animation asset to begin playing.
     * @param {number} [blendTime] - The time in seconds to blend from the current
     * animation state to the start of the animation being set. Defaults to 0.
     */
    play(name, blendTime = 0) {
        if (!this.enabled || !this.entity.enabled) {
            return;
        }

        if (!this.animations[name]) {
            Debug.error(`Trying to play animation '${name}' which doesn't exist`);
            return;
        }

        this.prevAnim = this.currAnim;
        this.currAnim = name;

        if (this.model) {

            if (!this.skeleton && !this.animEvaluator) {
                this._createAnimationController();
            }

            const prevAnim = this.animations[this.prevAnim];
            const currAnim = this.animations[this.currAnim];

            this.blending = blendTime > 0 && !!this.prevAnim;
            if (this.blending) {
                this.blend = 0;
                this.blendSpeed = 1 / blendTime;
            }

            if (this.skeleton) {
                if (this.blending) {
                    // Blend from the current time of the current animation to the start of
                    // the newly specified animation over the specified blend time period.
                    this.fromSkel.animation = prevAnim;
                    this.fromSkel.addTime(this.skeleton._time);
                    this.toSkel.animation = currAnim;
                } else {
                    this.skeleton.animation = currAnim;
                }
            }

            if (this.animEvaluator) {
                const animEvaluator = this.animEvaluator;

                if (this.blending) {
                    // remove all but the last clip
                    while (animEvaluator.clips.length > 1) {
                        animEvaluator.removeClip(0);
                    }
                } else {
                    this.animEvaluator.removeClips();
                }

                // pass the component as the event handler so any events embedded in the track
                // fire on this component (consistent with AnimComponent)
                const clip = new AnimClip(this.animations[this.currAnim], 0, 1.0, true, this.loop, this);
                clip.name = this.currAnim;
                clip.blendWeight = this.blending ? 0 : 1;
                clip.reset();
                this.animEvaluator.addClip(clip);
            }
        }

        this.playing = true;
    }

    /**
     * Return an animation.
     *
     * @param {string} name - The name of the animation asset.
     * @returns {Animation} An Animation.
     */
    getAnimation(name) {
        return this.animations[name];
    }

    /**
     * Set the model driven by this animation component.
     *
     * @param {Model} model - The model to set.
     * @ignore
     */
    setModel(model) {
        if (model !== this.model) {
            // reset animation controller
            this._resetAnimationController();

            // set the model
            this.model = model;

            // Reset the current animation on the new model
            if (this.animations && this.currAnim && this.animations[this.currAnim]) {
                this.play(this.currAnim);
            }
        }
    }

    onSetAnimations() {
        // If we have animations _and_ a model, we can create the skeletons
        const modelComponent = this.entity.model;
        if (modelComponent) {
            const m = modelComponent.model;
            if (m && m !== this.model) {
                this.setModel(m);
            }
        }

        if (!this.currAnim && this.activate && this.enabled && this.entity.enabled) {
            // Set the first loaded animation as the current
            const animationNames = Object.keys(this._animations);
            if (animationNames.length > 0) {
                this.play(animationNames[0]);
            }
        }
    }

    /** @private */
    _resetAnimationController() {
        this.skeleton = null;
        this.fromSkel = null;
        this.toSkel = null;

        this.animEvaluator = null;
    }

    /** @private */
    _createAnimationController() {
        const model = this.model;
        const animations = this.animations;

        // check which type of animations are loaded
        let hasJson = false;
        let hasGlb = false;
        for (const animation in animations) {
            if (animations.hasOwnProperty(animation)) {
                const anim = animations[animation];
                if (anim.constructor === AnimTrack) {
                    hasGlb = true;
                } else {
                    hasJson = true;
                }
            }
        }

        const graph = model.getGraph();
        if (hasJson) {
            this.fromSkel = new Skeleton(graph);
            this.toSkel = new Skeleton(graph);
            this.skeleton = new Skeleton(graph);
            this.skeleton.looping = this.loop;
            this.skeleton.setGraph(graph);
        } else if (hasGlb) {
            this.animEvaluator = new AnimEvaluator(new DefaultAnimBinder(this.entity));
        }
    }

    /**
     * @param {number[]} ids - Array of animation asset ids.
     * @private
     */
    loadAnimationAssets(ids) {
        if (!ids || !ids.length) {
            return;
        }

        const assets = this.system.app.assets;

        for (let i = 0, l = ids.length; i < l; i++) {
            const asset = assets.get(ids[i]);
            if (asset) {
                this._bindAsset(asset);
            } else {
                // the asset is not in the registry yet, so wait for it to be added
                const evtName = `add:${ids[i]}`;
                if (!this._pendingAssetAdds.has(evtName)) {
                    this._pendingAssetAdds.add(evtName);
                    assets.on(evtName, this._onAssetAdded, this);
                }
            }
        }
    }

    /**
     * Subscribe to the events of an animation asset and use its resources when they are available.
     *
     * @param {Asset} asset - The animation asset.
     * @private
     */
    _bindAsset(asset) {
        this._boundAssets.add(asset);

        asset.off('change', this.onAssetChanged, this);
        asset.on('change', this.onAssetChanged, this);

        asset.off('remove', this.onAssetRemoved, this);
        asset.on('remove', this.onAssetRemoved, this);

        if (asset.resource) {
            this._onAssetReady(asset);
        } else {
            asset.off('load', this._onAssetReady, this);
            asset.once('load', this._onAssetReady, this);
            if (this.enabled && this.entity.enabled) {
                this.system.app.assets.load(asset);
            }
        }
    }

    /**
     * Unsubscribe from the events of all animation assets this component is subscribed to, as well
     * as from any pending asset registry additions.
     *
     * @private
     */
    _unbindAssets() {
        const registry = this.system.app.assets;

        this._pendingAssetAdds.forEach((evtName) => {
            registry.off(evtName, this._onAssetAdded, this);
        });
        this._pendingAssetAdds.clear();

        this._boundAssets.forEach((asset) => {
            asset.off('change', this.onAssetChanged, this);
            asset.off('remove', this.onAssetRemoved, this);
            asset.off('load', this._onAssetReady, this);
        });
        this._boundAssets.clear();
    }

    /**
     * @param {Asset} asset - The animation asset that has been added to the asset registry.
     * @private
     */
    _onAssetAdded(asset) {
        const evtName = `add:${asset.id}`;
        this.system.app.assets.off(evtName, this._onAssetAdded, this);
        this._pendingAssetAdds.delete(evtName);

        this._bindAsset(asset);
    }

    /**
     * @param {Asset} asset - The animation asset with loaded resources.
     * @private
     */
    _onAssetReady(asset) {
        if (asset.resources.length > 1) {
            for (let i = 0; i < asset.resources.length; i++) {
                this.animations[asset.resources[i].name] = asset.resources[i];
                this.animationsIndex[asset.id] = asset.resources[i].name;
            }
        } else {
            this.animations[asset.name] = asset.resource;
            this.animationsIndex[asset.id] = asset.name;
        }
        /* eslint-disable no-self-assign */
        this.animations = this.animations; // assigning ensures set_animations event is fired
        /* eslint-enable no-self-assign */
    }

    /**
     * Handle asset change events.
     *
     * @param {Asset} asset - The asset that changed.
     * @param {string} attribute - The name of the asset attribute that changed. Can be 'data',
     * 'file', 'resource' or 'resources'.
     * @param {*} newValue - The new value of the specified asset property.
     * @param {*} oldValue - The old value of the specified asset property.
     * @private
     */
    onAssetChanged(asset, attribute, newValue, oldValue) {
        if (attribute === 'resource' || attribute === 'resources') {
            // If the attribute is 'resources', newValue can be an empty array when the
            // asset is unloaded. Therefore, we should assign null in this case
            if (attribute === 'resources' && newValue && newValue.length === 0) {
                newValue = null;
            }

            // replace old animation with new one
            if (newValue) {
                let restarted = false;
                if (newValue.length > 1) {
                    if (oldValue && oldValue.length > 1) {
                        for (let i = 0; i < oldValue.length; i++) {
                            delete this.animations[oldValue[i].name];
                        }
                    } else {
                        delete this.animations[asset.name];
                    }
                    restarted = false;
                    for (let i = 0; i < newValue.length; i++) {
                        this.animations[newValue[i].name] = newValue[i];

                        if (!restarted && this.currAnim === newValue[i].name) {
                            // restart animation
                            if (this.playing && this.enabled && this.entity.enabled) {
                                restarted = true;
                                this.play(newValue[i].name);
                            }
                        }
                    }
                    if (!restarted) {
                        this._stopCurrentAnimation();
                        this.onSetAnimations();
                    }
                } else {
                    if (oldValue && oldValue.length > 1) {
                        for (let i = 0; i < oldValue.length; i++) {
                            delete this.animations[oldValue[i].name];
                        }
                    }

                    this.animations[asset.name] = newValue[0] || newValue;
                    restarted = false;
                    if (this.currAnim === asset.name) {
                        // restart animation
                        if (this.playing && this.enabled && this.entity.enabled) {
                            restarted = true;
                            this.play(asset.name);
                        }
                    }
                    if (!restarted) {
                        this._stopCurrentAnimation();
                        this.onSetAnimations();
                    }
                }
                this.animationsIndex[asset.id] = asset.name;
            } else {
                if (oldValue.length > 1) {
                    for (let i = 0; i < oldValue.length; i++) {
                        delete this.animations[oldValue[i].name];
                        if (this.currAnim === oldValue[i].name) {
                            this._stopCurrentAnimation();
                        }
                    }
                } else {
                    delete this.animations[asset.name];
                    if (this.currAnim === asset.name) {
                        this._stopCurrentAnimation();
                    }
                }
                delete this.animationsIndex[asset.id];
            }
        }
    }

    /**
     * @param {Asset} asset - The asset that was removed.
     * @private
     */
    onAssetRemoved(asset) {
        asset.off('remove', this.onAssetRemoved, this);

        if (this.animations) {
            if (asset.resources.length > 1) {
                for (let i = 0; i < asset.resources.length; i++) {
                    delete this.animations[asset.resources[i].name];
                    if (this.currAnim === asset.resources[i].name) {
                        this._stopCurrentAnimation();
                    }
                }
            } else {
                delete this.animations[asset.name];
                if (this.currAnim === asset.name) {
                    this._stopCurrentAnimation();
                }
            }
            delete this.animationsIndex[asset.id];
        }
    }

    /** @private */
    _stopCurrentAnimation() {
        this.currAnim = null;

        this.playing = false;
        if (this.skeleton) {
            this.skeleton.currentTime = 0;
            this.skeleton.animation = null;
        }
        if (this.animEvaluator) {
            for (let i = 0; i < this.animEvaluator.clips.length; ++i) {
                this.animEvaluator.clips[i].stop();
            }
            this.animEvaluator.update(0);
            this.animEvaluator.removeClips();
        }
    }

    onEnable() {
        super.onEnable();

        // load assets if they're not loaded
        const assets = this.assets;
        const registry = this.system.app.assets;
        if (assets) {
            for (let i = 0, len = assets.length; i < len; i++) {
                let asset = assets[i];
                if (!(asset instanceof Asset)) {
                    asset = registry.get(asset);
                }

                if (asset && !asset.resource) {
                    registry.load(asset);
                }
            }
        }

        if (this.activate && !this.currAnim) {
            const animationNames = Object.keys(this.animations);
            if (animationNames.length > 0) {
                this.play(animationNames[0]);
            }
        }
    }

    onBeforeRemove() {
        this._unbindAssets();

        this.skeleton = null;
        this.fromSkel = null;
        this.toSkel = null;

        this.animEvaluator = null;
    }

    /**
     * Update the state of the component.
     *
     * @param {number} dt - The time delta.
     * @ignore
     */
    update(dt) {
        // update blending
        if (this.blending) {
            this.blend += dt * this.blendSpeed;
            if (this.blend >= 1) {
                this.blend = 1;
            }
        }

        // update skeleton
        if (this.playing) {
            const skeleton = this.skeleton;
            if (skeleton !== null && this.model !== null) {
                if (this.blending) {
                    skeleton.blend(this.fromSkel, this.toSkel, this.blend);
                } else {
                    // Advance the animation, interpolating keyframes at each animated node in
                    // skeleton
                    const delta = dt * this.speed;
                    skeleton.addTime(delta);
                    if (this.speed > 0 && (skeleton._time === skeleton.animation.duration) && !this.loop) {
                        this.playing = false;
                    } else if (this.speed < 0 && skeleton._time === 0 && !this.loop) {
                        this.playing = false;
                    }
                }

                if (this.blending && (this.blend === 1)) {
                    skeleton.animation = this.toSkel.animation;
                }

                skeleton.updateGraph();
            }
        }

        // update anim controller
        const animEvaluator = this.animEvaluator;
        if (animEvaluator) {

            // force all clips' speed and playing state from the component
            for (let i = 0; i < animEvaluator.clips.length; ++i) {
                const clip = animEvaluator.clips[i];
                clip.speed = this.speed;
                if (!this.playing) {
                    clip.pause();
                } else {
                    clip.resume();
                }
            }

            // update blend weight
            if (this.blending && animEvaluator.clips.length > 1) {
                animEvaluator.clips[1].blendWeight = this.blend;
            }

            animEvaluator.update(dt);
        }

        // clear blending flag
        if (this.blending && this.blend === 1) {
            this.blending = false;
        }
    }
}

export { AnimationComponent };
