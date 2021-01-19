import { Channel3d } from '../../../audio/channel3d.js';

import { Entity } from '../../entity.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AudioSourceComponent } from './component.js';
import { AudioSourceComponentData } from './data.js';

const _schema = [
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
 * @name AudioSourceComponentSystem
 * @augments ComponentSystem
 * @classdesc Controls playback of an audio sample. This class will be deprecated in favor of {@link SoundComponentSystem}.
 * @param {pc.Application} app - The application managing this system.
 * @param {pc.SoundManager} manager - A sound manager instance.
 */
class AudioSourceComponentSystem extends ComponentSystem {
    constructor(app, manager) {
        super(app);

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

    initializeComponentData(component, data, properties) {
        properties = ['activate', 'volume', 'pitch', 'loop', '3d', 'minDistance', 'maxDistance', 'rollOffFactor', 'distanceModel', 'enabled', 'assets'];
        super.initializeComponentData(component, data, properties);

        component.paused = !(component.enabled && component.activate);
    }

    onInitialize(root) {
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
    }

    onUpdate(dt) {
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
    }

    onRemove(entity, data) {
        if (data.channel) {
            data.channel.stop();
            data.channel = null;
        }
    }

    /**
     * @private
     * @function
     * @name AudioSourceComponentSystem#setVolume
     * @description Set the volume for the entire AudioSource system. All sources will
     * have their volume multiplied by this value.
     * @param {number} volume - The value to set the volume to. Valid from 0 to 1.
     */
    setVolume(volume) {
        this.manager.setVolume(volume);
    }
}

Component._buildAccessors(AudioSourceComponent.prototype, _schema);

export { AudioSourceComponentSystem };
