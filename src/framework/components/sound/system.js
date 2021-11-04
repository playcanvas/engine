import { hasAudioContext } from '../../../audio/capabilities.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { SoundComponent } from './component.js';
import { SoundComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * @class
 * @name SoundComponentSystem
 * @augments ComponentSystem
 * @classdesc Manages creation of {@link SoundComponent}s.
 * @description Create a SoundComponentSystem.
 * @param {Application} app - The Application.
 * @param {SoundManager} manager - The sound manager.
 * @property {number} volume Sets / gets the volume for the entire Sound system. All sounds will have their volume
 * multiplied by this value. Valid between [0, 1].
 * @property {AudioContext} context Gets the AudioContext currently used by the sound manager. Requires Web Audio API support.
 * @property {SoundManager} manager Gets / sets the sound manager.
 */
class SoundComponentSystem extends ComponentSystem {
    constructor(app, manager) {
        super(app);

        this.id = "sound";

        this.ComponentType = SoundComponent;
        this.DataType = SoundComponentData;

        this.schema = _schema;

        this.manager = manager;

        this.app.systems.on('update', this.onUpdate, this);

        this.on('beforeremove', this.onBeforeRemove, this);
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

    get volume() {
        return this.manager.volume;
    }

    set volume(volume) {
        this.manager.volume = volume;
    }

    get context() {
        if (!hasAudioContext()) {
            // #if _DEBUG
            console.warn('WARNING: Audio context is not supported on this browser');
            // #endif
            return null;
        }

        return this.manager.context;
    }
}

Component._buildAccessors(SoundComponent.prototype, _schema);

export { SoundComponentSystem };
