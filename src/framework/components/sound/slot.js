import { EventHandler } from '../../../core/event-handler.js';
import { Debug } from '../../../core/debug.js';

import { math } from '../../../core/math/math.js';
import { Vec3 } from '../../../core/math/vec3.js';

import { Asset } from '../../asset/asset.js';

import { SoundInstance } from '../../../platform/sound/instance.js';
import { SoundInstance3d } from '../../../platform/sound/instance3d.js';

// temporary object for creating instances
const instanceOptions = {
    volume: 0,
    pitch: 0,
    loop: false,
    startTime: 0,
    duration: 0,
    position: new Vec3(),
    maxDistance: 0,
    refDistance: 0,
    rollOffFactor: 0,
    distanceModel: 0,
    onPlay: null,
    onPause: null,
    onResume: null,
    onStop: null,
    onEnd: null
};

/**
 * The SoundSlot controls playback of an audio asset.
 *
 * @category Sound
 */
class SoundSlot extends EventHandler {
    /**
     * Fired when a {@link SoundInstance} starts playing on a slot. The handler is passed the sound
     * instance that started playing.
     *
     * @event
     * @example
     * slot.on('play', (instance) => {
     *     console.log('Sound instance started playing');
     * });
     */
    static EVENT_PLAY = 'play';

    /**
     * Fired when a {@link SoundInstance} is paused on a slot. The handler is passed the sound
     * instance that is paused.
     *
     * @event
     * @example
     * slot.on('pause', (instance) => {
     *     console.log('Sound instance paused');
     * });
     */
    static EVENT_PAUSE = 'pause';

    /**
     * Fired when a {@link SoundInstance} is resumed on a slot. The handler is passed the sound
     * instance that is resumed.
     *
     * @event
     * @example
     * slot.on('resume', (instance) => {
     *     console.log('Sound instance resumed');
     * });
     */
    static EVENT_RESUME = 'resume';

    /**
     * Fired when a {@link SoundInstance} is stopped on a slot. The handler is passed the sound
     * instance that is stopped.
     *
     * @event
     * @example
     * slot.on('stop', (instance) => {
     *     console.log('Sound instance stopped');
     * });
     */
    static EVENT_STOP = 'stop';

    /**
     * Fired when the sound {@link Asset} assigned to the slot is loaded. The handler is passed the
     * loaded {@link Sound} resource.
     *
     * @event
     * @example
     * slot.on('load', (sound) => {
     *     console.log('Sound resource loaded');
     * });
     */
    static EVENT_LOAD = 'load';

    /**
     * The name of the slot.
     *
     * @type {string}
     */
    name;

    /**
     * An array that contains all the {@link SoundInstance}s currently being played by the slot.
     *
     * @type {SoundInstance[]}
     */
    instances = [];

    /**
     * Create a new SoundSlot.
     *
     * @param {import('./component.js').SoundComponent} component - The Component that created this
     * slot.
     * @param {string} [name] - The name of the slot. Defaults to 'Untitled'.
     * @param {object} [options] - Settings for the slot.
     * @param {number} [options.volume] - The playback volume, between 0 and 1.
     * @param {number} [options.pitch] - The relative pitch, default of 1, plays at normal pitch.
     * @param {boolean} [options.loop] - If true, the sound will restart when it reaches the end.
     * @param {number} [options.startTime] - The start time from which the sound will start
     * playing.
     * @param {number} [options.duration] - The duration of the sound that the slot will play
     * starting from startTime.
     * @param {boolean} [options.overlap] - If true, then sounds played from slot will be played
     * independently of each other. Otherwise the slot will first stop the current sound before
     * starting the new one.
     * @param {boolean} [options.autoPlay] - If true, the slot will start playing as soon as its
     * audio asset is loaded.
     * @param {number} [options.asset] - The asset id of the audio asset that is going to be played
     * by this slot.
     */
    constructor(component, name = 'Untitled', options = {}) {
        super();

        this._component = component;
        this._assets = component.system.app.assets;
        this._manager = component.system.manager;

        this.name = name;

        this._volume = options.volume !== undefined ? math.clamp(Number(options.volume) || 0, 0, 1) : 1;
        this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;
        this._loop = !!(options.loop !== undefined ? options.loop : false);
        this._duration = options.duration > 0 ? options.duration : null;
        this._startTime = Math.max(0, Number(options.startTime) || 0);
        this._overlap = !!(options.overlap);
        this._autoPlay = !!(options.autoPlay);
        this._firstNode = null;
        this._lastNode = null;

        this._asset = options.asset;
        if (this._asset instanceof Asset) {
            this._asset = this._asset.id;
        }

        this._onInstancePlayHandler = this._onInstancePlay.bind(this);
        this._onInstancePauseHandler = this._onInstancePause.bind(this);
        this._onInstanceResumeHandler = this._onInstanceResume.bind(this);
        this._onInstanceStopHandler = this._onInstanceStop.bind(this);
        this._onInstanceEndHandler = this._onInstanceEnd.bind(this);
    }

    /**
     * Plays a sound. If {@link SoundSlot#overlap} is true the new sound instance will be played
     * independently of any other instances already playing. Otherwise existing sound instances
     * will stop before playing the new sound.
     *
     * @returns {SoundInstance} The new sound instance.
     */
    play() {
        // stop if overlap is false
        if (!this.overlap) {
            this.stop();
        }

        // If not loaded and doesn't have asset - then we cannot play it.  Warn and exit.
        if (!this.isLoaded && !this._hasAsset()) {
            Debug.warn(`Trying to play SoundSlot ${this.name} but it is not loaded and doesn't have an asset.`);
            return undefined;
        }

        const instance = this._createInstance();
        this.instances.push(instance);

        // if not loaded then load first
        // and then set sound resource on the created instance
        if (!this.isLoaded) {
            const onLoad = function (sound) {
                const playWhenLoaded = instance._playWhenLoaded;
                instance.sound = sound;
                if (playWhenLoaded) {
                    instance.play();
                }
            };

            this.off('load', onLoad);
            this.once('load', onLoad);
            this.load();
        } else {
            instance.play();
        }

        return instance;
    }

    /**
     * Pauses all sound instances. To continue playback call {@link SoundSlot#resume}.
     *
     * @returns {boolean} True if the sound instances paused successfully, false otherwise.
     */
    pause() {
        let paused = false;

        const instances = this.instances;
        for (let i = 0, len = instances.length; i < len; i++) {
            if (instances[i].pause()) {
                paused = true;
            }
        }

        return paused;
    }

    /**
     * Resumes playback of all paused sound instances.
     *
     * @returns {boolean} True if any instances were resumed.
     */
    resume() {
        let resumed = false;

        const instances = this.instances;
        for (let i = 0, len = instances.length; i < len; i++) {
            if (instances[i].resume())
                resumed = true;
        }

        return resumed;
    }

    /**
     * Stops playback of all sound instances.
     *
     * @returns {boolean} True if any instances were stopped.
     */
    stop() {
        let stopped = false;

        const instances = this.instances;
        let i = instances.length;
        // do this in reverse order because as each instance
        // is stopped it will be removed from the instances array
        // by the instance stop event handler
        while (i--) {
            instances[i].stop();
            stopped = true;
        }

        instances.length = 0;

        return stopped;
    }

    /**
     * Loads the asset assigned to this slot.
     */
    load() {
        if (!this._hasAsset())
            return;

        const asset = this._assets.get(this._asset);
        if (!asset) {
            this._assets.off('add:' + this._asset, this._onAssetAdd, this);
            this._assets.once('add:' + this._asset, this._onAssetAdd, this);
            return;
        }

        asset.off('remove', this._onAssetRemoved, this);
        asset.on('remove', this._onAssetRemoved, this);

        if (!asset.resource) {
            asset.off('load', this._onAssetLoad, this);
            asset.once('load', this._onAssetLoad, this);

            this._assets.load(asset);

            return;
        }

        this.fire('load', asset.resource);
    }

    /**
     * Connect external Web Audio API nodes. Any sound played by this slot will automatically
     * attach the specified nodes to the source that plays the sound. You need to pass the first
     * node of the node graph that you created externally and the last node of that graph. The
     * first node will be connected to the audio source and the last node will be connected to the
     * destination of the AudioContext (e.g. speakers).
     *
     * @param {AudioNode} firstNode - The first node that will be connected to the audio source of
     * sound instances.
     * @param {AudioNode} [lastNode] - The last node that will be connected to the destination of
     * the AudioContext. If unspecified then the firstNode will be connected to the destination
     * instead.
     * @example
     * const context = app.systems.sound.context;
     * const analyzer = context.createAnalyzer();
     * const distortion = context.createWaveShaper();
     * const filter = context.createBiquadFilter();
     * analyzer.connect(distortion);
     * distortion.connect(filter);
     * slot.setExternalNodes(analyzer, filter);
     */
    setExternalNodes(firstNode, lastNode) {
        if (!(firstNode)) {
            console.error('The firstNode must have a valid AudioNode');
            return;
        }

        if (!lastNode) {
            lastNode = firstNode;
        }

        this._firstNode = firstNode;
        this._lastNode = lastNode;

        // update instances if not overlapping
        if (!this._overlap) {
            const instances = this.instances;
            for (let i = 0, len = instances.length; i < len; i++) {
                instances[i].setExternalNodes(firstNode, lastNode);
            }
        }
    }

    /**
     * Clears any external nodes set by {@link SoundSlot#setExternalNodes}.
     */
    clearExternalNodes() {
        this._firstNode = null;
        this._lastNode = null;

        // update instances if not overlapping
        if (!this._overlap) {
            const instances = this.instances;
            for (let i = 0, len = instances.length; i < len; i++) {
                instances[i].clearExternalNodes();
            }
        }
    }

    /**
     * Gets an array that contains the two external nodes set by {@link SoundSlot#setExternalNodes}.
     *
     * @returns {AudioNode[]} An array of 2 elements that contains the first and last nodes set by
     * {@link SoundSlot#setExternalNodes}.
     */
    getExternalNodes() {
        return [this._firstNode, this._lastNode];
    }

    /**
     * Reports whether an asset is set on this slot.
     *
     * @returns {boolean} Returns true if the slot has an asset assigned.
     * @private
     */
    _hasAsset() {
        // != intentional
        return this._asset != null;
    }

    /**
     * Creates a new {@link SoundInstance} with the properties of the slot.
     *
     * @returns {SoundInstance} The new instance.
     * @private
     */
    _createInstance() {
        let instance = null;

        const component = this._component;

        let sound = null;

        // get sound resource
        if (this._hasAsset()) {
            const asset = this._assets.get(this._asset);
            if (asset) {
                sound = asset.resource;
            }
        }

        // initialize instance options
        const data = instanceOptions;
        data.volume = this._volume * component.volume;
        data.pitch = this._pitch * component.pitch;
        data.loop = this._loop;
        data.startTime = this._startTime;
        data.duration = this._duration;

        data.onPlay = this._onInstancePlayHandler;
        data.onPause = this._onInstancePauseHandler;
        data.onResume = this._onInstanceResumeHandler;
        data.onStop = this._onInstanceStopHandler;
        data.onEnd = this._onInstanceEndHandler;

        if (component.positional) {
            data.position.copy(component.entity.getPosition());
            data.maxDistance = component.maxDistance;
            data.refDistance = component.refDistance;
            data.rollOffFactor = component.rollOffFactor;
            data.distanceModel = component.distanceModel;

            instance = new SoundInstance3d(this._manager, sound, data);
        } else {
            instance = new SoundInstance(this._manager, sound, data);
        }

        // hook external audio nodes
        if (this._firstNode) {
            instance.setExternalNodes(this._firstNode, this._lastNode);
        }

        return instance;
    }

    _onInstancePlay(instance) {
        // propagate event to slot
        this.fire('play', instance);

        // propagate event to component
        this._component.fire('play', this, instance);
    }

    _onInstancePause(instance) {
        // propagate event to slot
        this.fire('pause', instance);

        // propagate event to component
        this._component.fire('pause', this, instance);
    }

    _onInstanceResume(instance) {
        // propagate event to slot
        this.fire('resume', instance);

        // propagate event to component
        this._component.fire('resume', this, instance);
    }

    _onInstanceStop(instance) {
        // remove instance that stopped
        const idx = this.instances.indexOf(instance);
        if (idx !== -1) {
            this.instances.splice(idx, 1);
        }

        // propagate event to slot
        this.fire('stop', instance);

        // propagate event to component
        this._component.fire('stop', this, instance);
    }

    _onInstanceEnd(instance) {
        // remove instance that ended
        const idx = this.instances.indexOf(instance);
        if (idx !== -1) {
            this.instances.splice(idx, 1);
        }

        // propagate event to slot
        this.fire('end', instance);

        // propagate event to component
        this._component.fire('end', this, instance);
    }

    _onAssetAdd(asset) {
        this.load();
    }

    _onAssetLoad(asset) {
        this.load();
    }

    _onAssetRemoved(asset) {
        asset.off('remove', this._onAssetRemoved, this);
        this._assets.off('add:' + asset.id, this._onAssetAdd, this);
        this.stop();
    }

    updatePosition(position) {
        const instances = this.instances;
        for (let i = 0, len = instances.length; i < len; i++) {
            instances[i].position = position;
        }
    }

    /**
     * Sets the asset id.
     *
     * @type {number|null}
     */
    set asset(value) {
        const old = this._asset;

        if (old) {
            this._assets.off('add:' + old, this._onAssetAdd, this);
            const oldAsset = this._assets.get(old);
            if (oldAsset) {
                oldAsset.off('remove', this._onAssetRemoved, this);
            }
        }

        this._asset = value;
        if (this._asset instanceof Asset) {
            this._asset = this._asset.id;
        }

        // load asset if component and entity are enabled
        if (this._hasAsset() && this._component.enabled && this._component.entity.enabled) {
            this.load();
        }
    }

    /**
     * Gets the asset id.
     *
     * @type {number|null}
     */
    get asset() {
        return this._asset;
    }

    /**
     * Sets whether the slot will begin playing as soon as it is loaded.
     *
     * @type {boolean}
     */
    set autoPlay(value) {
        this._autoPlay = !!value;
    }

    /**
     * Gets whether the slot will begin playing as soon as it is loaded.
     *
     * @type {boolean}
     */
    get autoPlay() {
        return this._autoPlay;
    }

    /**
     * Sets the duration of the sound that the slot will play starting from startTime.
     *
     * @type {number}
     */
    set duration(value) {
        this._duration = Math.max(0, Number(value) || 0) || null;

        // update instances if non overlapping
        if (!this._overlap) {
            const instances = this.instances;
            for (let i = 0, len = instances.length; i < len; i++) {
                instances[i].duration = this._duration;
            }
        }
    }

    /**
     * Gets the duration of the sound that the slot will play starting from startTime.
     *
     * @type {number}
     */
    get duration() {
        let assetDuration = 0;
        if (this._hasAsset()) {
            const asset = this._assets.get(this._asset);
            assetDuration = asset?.resource ? asset.resource.duration : 0;
        }

        // != intentional
        if (this._duration != null) {
            return this._duration % (assetDuration || 1);
        }
        return assetDuration;
    }

    /**
     * Gets whether the asset of the slot is loaded.
     *
     * @type {boolean}
     */
    get isLoaded() {
        if (this._hasAsset()) {
            const asset = this._assets.get(this._asset);
            if (asset) {
                return !!asset.resource;
            }
        }

        return false;
    }

    /**
     * Gets whether the slot is currently paused.
     *
     * @type {boolean}
     */
    get isPaused() {
        const instances = this.instances;
        const len = instances.length;
        if (len === 0)
            return false;

        for (let i = 0; i < len; i++) {
            if (!instances[i].isPaused)
                return false;
        }

        return true;
    }

    /**
     * Gets whether the slot is currently playing.
     *
     * @type {boolean}
     */
    get isPlaying() {
        const instances = this.instances;
        for (let i = 0, len = instances.length; i < len; i++) {
            if (instances[i].isPlaying)
                return true;
        }

        return false;
    }

    /**
     * Gets whether the slot is currently stopped.
     *
     * @type {boolean}
     */
    get isStopped() {
        const instances = this.instances;
        for (let i = 0, len = instances.length; i < len; i++) {
            if (!instances[i].isStopped)
                return false;
        }

        return true;
    }

    /**
     * Sets whether the slot will restart when it finishes playing.
     *
     * @type {boolean}
     */
    set loop(value) {
        this._loop = !!value;

        // update instances if non overlapping
        const instances = this.instances;
        for (let i = 0, len = instances.length; i < len; i++) {
            instances[i].loop = this._loop;
        }
    }

    /**
     * Gets whether the slot will restart when it finishes playing.
     *
     * @type {boolean}
     */
    get loop() {
        return this._loop;
    }

    /**
     * Sets whether the sounds played from this slot will be played independently of each other.
     * Otherwise, the slot will first stop the current sound before starting the new one.
     *
     * @type {boolean}
     */
    set overlap(value) {
        this._overlap = !!value;
    }

    /**
     * Gets whether the sounds played from this slot will be played independently of each other.
     *
     * @type {boolean}
     */
    get overlap() {
        return this._overlap;
    }

    /**
     * Sets the pitch modifier to play the sound with. Must be larger than 0.01.
     *
     * @type {number}
     */
    set pitch(value) {
        this._pitch = Math.max(Number(value) || 0, 0.01);

        // update instances if non overlapping
        if (!this._overlap) {
            const instances = this.instances;
            for (let i = 0, len = instances.length; i < len; i++) {
                instances[i].pitch = this.pitch * this._component.pitch;
            }
        }
    }

    /**
     * Gets the pitch modifier to play the sound with.
     *
     * @type {number}
     */
    get pitch() {
        return this._pitch;
    }

    /**
     * Sets the start time from which the sound will start playing.
     *
     * @type {number}
     */
    set startTime(value) {
        this._startTime = Math.max(0, Number(value) || 0);

        // update instances if non overlapping
        if (!this._overlap) {
            const instances = this.instances;
            for (let i = 0, len = instances.length; i < len; i++) {
                instances[i].startTime = this._startTime;
            }
        }
    }

    /**
     * Gets the start time from which the sound will start playing.
     *
     * @type {number}
     */
    get startTime() {
        return this._startTime;
    }

    /**
     * Sets the volume modifier to play the sound with. In range 0-1.
     *
     * @type {number}
     */
    set volume(value) {
        this._volume = math.clamp(Number(value) || 0, 0, 1);

        // update instances if non overlapping
        if (!this._overlap) {
            const instances = this.instances;
            for (let i = 0, len = instances.length; i < len; i++) {
                instances[i].volume = this._volume * this._component.volume;
            }
        }
    }

    /**
     * Gets the volume modifier to play the sound with.
     *
     * @type {number}
     */
    get volume() {
        return this._volume;
    }
}

export { SoundSlot };
