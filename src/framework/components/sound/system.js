import { hasAudioContext } from '../../../audio/capabilities.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { SoundComponent } from './component.js';
import { SoundComponentData } from './data.js';

var _schema = ['enabled'];

/**
 * @class
 * @name pc.SoundComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc Manages creation of {@link pc.SoundComponent}s.
 * @description Create a SoundComponentSystem.
 * @param {pc.Application} app - The Application.
 * @param {pc.SoundManager} manager - The sound manager.
 * @property {number} volume Sets / gets the volume for the entire Sound system. All sounds will have their volume
 * multiplied by this value. Valid between [0, 1].
 * @property {AudioContext} context Gets the AudioContext currently used by the sound manager. Requires Web Audio API support.
 * @property {pc.SoundManager} manager Gets / sets the sound manager.
 */
var SoundComponentSystem = function (app, manager) {
    ComponentSystem.call(this, app);

    this.id = "sound";

    this.ComponentType = SoundComponent;
    this.DataType = SoundComponentData;

    this.schema = _schema;

    this.manager = manager;

    ComponentSystem.bind('update', this.onUpdate, this);

    this.on('beforeremove', this.onBeforeRemove, this);
};
SoundComponentSystem.prototype = Object.create(ComponentSystem.prototype);
SoundComponentSystem.prototype.constructor = SoundComponentSystem;

Component._buildAccessors(SoundComponent.prototype, _schema);

Object.assign(SoundComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
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

        ComponentSystem.prototype.initializeComponentData.call(this, component, data, ['enabled']);
    },

    cloneComponent: function (entity, clone) {
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
    },

    onUpdate: function (dt) {
        var store = this.store;

        for (var id in store) {
            if (store.hasOwnProperty(id)) {
                var item = store[id];
                var entity = item.entity;
                var componentData = item.data;

                // Update slot position if this is a 3d sound
                if (componentData.enabled && entity.enabled && componentData.positional) {
                    var position = entity.getPosition();
                    var slots = componentData.slots;
                    for (var key in slots) {
                        slots[key].updatePosition(position);
                    }
                }
            }
        }
    },

    onBeforeRemove: function (entity, component) {
        var slots = component.slots;
        // stop non overlapping sounds
        for (var key in slots) {
            if (!slots[key].overlap) {
                slots[key].stop();
            }
        }

        component.onRemove();
    }
});

Object.defineProperty(SoundComponentSystem.prototype, 'volume', {
    get: function () {
        return this.manager.volume;
    },
    set: function (volume) {
        this.manager.volume = volume;
    }
});

Object.defineProperty(SoundComponentSystem.prototype, 'context', {
    get: function () {
        if (!hasAudioContext()) {
            // #ifdef DEBUG
            console.warn('WARNING: Audio context is not supported on this browser');
            // #endif
            return null;
        }

        return this.manager.context;
    }
});

export { SoundComponentSystem };
