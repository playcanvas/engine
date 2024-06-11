import { Debug } from '../../../core/debug.js';

import { hasAudioContext } from '../../../platform/audio/capabilities.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { SoundComponent } from './component.js';
import { SoundComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Manages creation of {@link SoundComponent}s.
 *
 * @category Sound
 */
class SoundComponentSystem extends ComponentSystem {
    /**
     * Create a SoundComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The Application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'sound';

        this.ComponentType = SoundComponent;
        this.DataType = SoundComponentData;

        this.schema = _schema;

        /**
         * Gets / sets the sound manager.
         *
         * @type {import('../../../platform/sound/manager.js').SoundManager}
         */
        this.manager = app.soundManager;
        Debug.assert(this.manager, "SoundComponentSystem cannot be created without sound manager");

        this.app.systems.on('update', this.onUpdate, this);

        this.on('beforeremove', this.onBeforeRemove, this);
    }

    /**
     * Sets the volume for the entire Sound system. All sounds will have their volume multiplied by
     * this value. Valid between [0, 1].
     *
     * @type {number}
     */
    set volume(volume) {
        this.manager.volume = volume;
    }

    /**
     * Gets the volume for the entire Sound system.
     *
     * @type {number}
     */
    get volume() {
        return this.manager.volume;
    }

    /**
     * Gets the AudioContext currently used by the sound manager. Requires Web Audio API support.
     * Returns null if the device does not support the Web Audio API.
     *
     * @type {AudioContext|null}
     */
    get context() {
        if (!hasAudioContext()) {
            Debug.warn('WARNING: Audio context is not supported on this browser');
            return null;
        }

        return this.manager.context;
    }

    initializeComponentData(component, data, properties) {
        properties = [
            'volume',
            'pitch',
            'positional',
            'refDistance',
            'maxDistance',
            'rollOffFactor',
            'distanceModel',
            'slots'
        ];

        for (let i = 0; i < properties.length; i++) {
            if (data.hasOwnProperty(properties[i])) {
                component[properties[i]] = data[properties[i]];
            }
        }

        super.initializeComponentData(component, data, ['enabled']);
    }

    cloneComponent(entity, clone) {
        const srcComponent = entity.sound;
        const srcSlots = srcComponent.slots;

        // convert 'slots' back to
        // simple option objects
        const slots = {};
        for (const key in srcSlots) {
            const srcSlot = srcSlots[key];
            slots[key] = {
                name: srcSlot.name,
                volume: srcSlot.volume,
                pitch: srcSlot.pitch,
                loop: srcSlot.loop,
                duration: srcSlot.duration,
                startTime: srcSlot.startTime,
                overlap: srcSlot.overlap,
                autoPlay: srcSlot.autoPlay,
                asset: srcSlot.asset
            };
        }

        const cloneData = {
            distanceModel: srcComponent.distanceModel,
            enabled: srcComponent.enabled,
            maxDistance: srcComponent.maxDistance,
            pitch: srcComponent.pitch,
            positional: srcComponent.positional,
            refDistance: srcComponent.refDistance,
            rollOffFactor: srcComponent.rollOffFactor,
            slots: slots,
            volume: srcComponent.volume
        };

        // add component with new data
        return this.addComponent(clone, cloneData);
    }

    onUpdate(dt) {
        const store = this.store;

        for (const id in store) {
            if (store.hasOwnProperty(id)) {
                const item = store[id];
                const entity = item.entity;

                if (entity.enabled) {
                    const component = entity.sound;

                    // Update slot position if this is a 3d sound
                    if (component.enabled && component.positional) {
                        const position = entity.getPosition();
                        const slots = component.slots;
                        for (const key in slots) {
                            slots[key].updatePosition(position);
                        }
                    }
                }
            }
        }
    }

    onBeforeRemove(entity, component) {
        const slots = component.slots;
        // stop non overlapping sounds
        for (const key in slots) {
            if (!slots[key].overlap) {
                slots[key].stop();
            }
        }

        component.onRemove();
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

Component._buildAccessors(SoundComponent.prototype, _schema);

export { SoundComponentSystem };
