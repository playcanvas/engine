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
class SoundComponentSystem extends ComponentSystem  {
    constructor(app, manager) {
        super(app);

        this.id = "sound";

        this.ComponentType = SoundComponent;
        this.DataType = SoundComponentData;

        this.schema = _schema;

        this.manager = manager;

        ComponentSystem.bind('update', this.onUpdate, this);

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

        for (var i = 0; i < properties.length; i++) {
            if (data.hasOwnProperty(properties[i])) {
                component[properties[i]] = data[properties[i]];
            }
        }

        super.initializeComponentData(component, data, ['enabled']);
    }

    cloneComponent(entity, clone) {
        var srcComponent = entity.sound;
        var srcSlots = srcComponent.slots;

        // convert 'slots' back to
        // simple option objects
        var slots = {};
        for (var key in srcSlots) {
            var srcSlot = srcSlots[key];
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

        var cloneData = {
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
        var store = this.store;

        for (var id in store) {
            if (store.hasOwnProperty(id)) {
                var item = store[id];
                var entity = item.entity;

                if (entity.enabled) {
                    var component = entity.sound;

                    // Update slot position if this is a 3d sound
                    if (component.enabled && component.positional) {
                        var position = entity.getPosition();
                        var slots = component.slots;
                        for (var key in slots) {
                            slots[key].updatePosition(position);
                        }
                    }
                }
            }
        }
    }

    onBeforeRemove(entity, component) {
        var slots = component.slots;
        // stop non overlapping sounds
        for (var key in slots) {
            if (!slots[key].overlap) {
                slots[key].stop();
            }
        }

        component.onRemove();
    }

    get volume() {
        return this.manager.volume;
    }

    set volume(volume) {
        this.manager.volume = volume;
    }

    get context() {
        if (!hasAudioContext()) {
            // #ifdef DEBUG
            console.warn('WARNING: Audio context is not supported on this browser');
            // #endif
            return null;
        }

        return this.manager.context;
    }
}

Component._buildAccessors(SoundComponent.prototype, _schema);

export { SoundComponentSystem };
