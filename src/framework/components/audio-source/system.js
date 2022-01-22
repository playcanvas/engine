import { Channel3d } from '../../../audio/channel3d.js';

import { Entity } from '../../entity.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AudioSourceComponent } from './component.js';
import { AudioSourceComponentData } from './data.js';

/** @typedef {import('../../application.js').Application} Application */
/** @typedef {import('../../../sound/manager.js').SoundManager} SoundManager */

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
 * Controls playback of an audio sample. This class will be deprecated in favor of
 * {@link SoundComponentSystem}.
 *
 * @augments ComponentSystem
 * @ignore
 */
class AudioSourceComponentSystem extends ComponentSystem {
    /**
     * Create a new AudioSourceComponentSystem instance.
     *
     * @param {Application} app - The application managing this system.
     * @param {SoundManager} manager - A sound manager instance.
     */
    constructor(app, manager) {
        super(app);

        this.id = "audiosource";

        this.ComponentType = AudioSourceComponent;
        this.DataType = AudioSourceComponentData;

        this.schema = _schema;

        this.manager = manager;

        this.initialized = false;

        this.app.systems.on('initialize', this.onInitialize, this);
        this.app.systems.on('update', this.onUpdate, this);

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

        const children = root._children;
        for (let i = 0, len = children.length; i < len; i++) {
            if (children[i] instanceof Entity) {
                this.onInitialize(children[i]);
            }
        }

        this.initialized = true;
    }

    onUpdate(dt) {
        const components = this.store;

        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const component = components[id];
                const entity = component.entity;
                const componentData = component.data;

                // Update channel position if this is a 3d sound
                if (componentData.enabled && entity.enabled && componentData.channel instanceof Channel3d) {
                    const pos = entity.getPosition();
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
     * Set the volume for the entire AudioSource system. All sources will have their volume
     * multiplied by this value.
     *
     * @param {number} volume - The value to set the volume to. Valid from 0 to 1.
     */
    setVolume(volume) {
        this.manager.setVolume(volume);
    }

    destroy() {
        super.destroy();

        this.app.systems.off('initialize', this.onInitialize, this);
        this.app.systems.off('update', this.onUpdate, this);
    }
}

Component._buildAccessors(AudioSourceComponent.prototype, _schema);

export { AudioSourceComponentSystem };
