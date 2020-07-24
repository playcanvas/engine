import { Channel3d } from '../../../audio/channel3d.js';

import { Entity } from '../../entity.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AudioSourceComponent } from './component.js';
import { AudioSourceComponentData } from './data.js';

var _schema = [
    'enabled',
    'assets',
    'volume',
    'pitch',
    'loop',
    'activate',
    '3d',
    'minDistance',
    'maxDistance',
    'rollOffFactor',
    'distanceModel',
    'sources',
    'currentSource',
    'channel'
];

/**
 * @private
 * @class
 * @name pc.AudioSourceComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc Controls playback of an audio sample. This class will be deprecated in favor of {@link pc.SoundComponentSystem}.
 * @param {pc.Application} app - The application managing this system.
 * @param {pc.SoundManager} manager - A sound manager instance.
 */
function AudioSourceComponentSystem(app, manager) {
    ComponentSystem.call(this, app);

    this.id = "audiosource";

    this.ComponentType = AudioSourceComponent;
    this.DataType = AudioSourceComponentData;

    this.schema = _schema;

    this.manager = manager;

    this.initialized = false;

    ComponentSystem.bind('initialize', this.onInitialize, this);
    ComponentSystem.bind('update', this.onUpdate, this);

    this.on('remove', this.onRemove, this);
}
AudioSourceComponentSystem.prototype = Object.create(ComponentSystem.prototype);
AudioSourceComponentSystem.prototype.constructor = AudioSourceComponentSystem;

Component._buildAccessors(AudioSourceComponent.prototype, _schema);

Object.assign(AudioSourceComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
        properties = ['activate', 'volume', 'pitch', 'loop', '3d', 'minDistance', 'maxDistance', 'rollOffFactor', 'distanceModel', 'enabled', 'assets'];
        ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);

        component.paused = !(component.enabled && component.activate);
    },

    onInitialize: function (root) {
        if (root.audiosource &&
            root.enabled &&
            root.audiosource.enabled &&
            root.audiosource.activate) {

            root.audiosource.play(root.audiosource.currentSource);
        }

        var children = root._children;
        var i, len = children.length;
        for (i = 0; i < len; i++) {
            if (children[i] instanceof Entity) {
                this.onInitialize(children[i]);
            }
        }

        this.initialized = true;
    },

    onUpdate: function (dt) {
        var components = this.store;

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var component = components[id];
                var entity = component.entity;
                var componentData = component.data;

                // Update channel position if this is a 3d sound
                if (componentData.enabled && entity.enabled && componentData.channel instanceof Channel3d) {
                    var pos = entity.getPosition();
                    componentData.channel.setPosition(pos);
                }
            }
        }
    },

    onRemove: function (entity, data) {
        if (data.channel) {
            data.channel.stop();
            data.channel = null;
        }
    },

    /**
     * @private
     * @function
     * @name pc.AudioSourceComponentSystem#setVolume
     * @description Set the volume for the entire AudioSource system. All sources will
     * have their volume multiplied by this value.
     * @param {number} volume - The value to set the volume to. Valid from 0 to 1.
     */
    setVolume: function (volume) {
        this.manager.setVolume(volume);
    }
});

export { AudioSourceComponentSystem };
