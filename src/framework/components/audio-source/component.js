import { Asset } from '../../../asset/asset.js';

import { Channel3d } from '../../../audio/channel3d.js';

import { Component } from '../component.js';

/**
 * @private
 * @component
 * @class
 * @name AudioSourceComponent
 * @augments pc.Component
 * @classdesc The AudioSource Component controls playback of an audio sample. This
 * class will be deprecated in favor of {@link pc.SoundComponent}.
 * @description Create a new AudioSource Component.
 * @param {pc.AudioSourceComponentSystem} system - The ComponentSystem that created
 * this component.
 * @param {pc.Entity} entity - The entity that the Component is attached to.
 * @property {pc.Asset[]} assets The list of audio assets - can also be an array of
 * asset ids.
 * @property {boolean} activate If true the audio will begin playing as soon as the
 * scene is loaded.
 * @property {number} volume The volume modifier to play the audio with. In range 0-1.
 * @property {number} pitch The pitch modifier to play the audio with. Must be larger
 * than 0.01.
 * @property {boolean} loop If true the audio will restart when it finishes playing.
 * @property {boolean} 3d If true the audio will play back at the location of the*
 * entity in space, so the audio will be affect by the position of the
 * {@link pc.AudioListenerComponent}.
 * @property {string} distanceModel Determines which algorithm to use to reduce the
 * volume of the audio as it moves away from the listener. Can be:
 *
 * * "linear"
 * * "inverse"
 * * "exponential"
 *
 * Default is "inverse".
 * @property {number} minDistance The minimum distance from the listener at which
 * audio falloff begins.
 * @property {number} maxDistance The maximum distance from the listener at which
 * audio falloff stops. Note the volume of the audio is not 0 after this distance,
 * but just doesn't fall off anymore.
 * @property {number} rollOffFactor The factor used in the falloff equation.
 */
class AudioSourceComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        this.on("set_assets", this.onSetAssets, this);
        this.on("set_loop", this.onSetLoop, this);
        this.on("set_volume", this.onSetVolume, this);
        this.on("set_pitch", this.onSetPitch, this);
        this.on("set_minDistance", this.onSetMinDistance, this);
        this.on("set_maxDistance", this.onSetMaxDistance, this);
        this.on("set_rollOffFactor", this.onSetRollOffFactor, this);
        this.on("set_distanceModel", this.onSetDistanceModel, this);
        this.on("set_3d", this.onSet3d, this);
    }

    /**
     * @private
     * @function
     * @name AudioSourceComponent#play
     * @description Begin playback of an audio asset in the component attached to an entity.
     * @param {string} name - The name of the Asset to play.
     */
    play(name) {
        if (!this.enabled || !this.entity.enabled) {
            return;
        }

        if (this.channel) {
            // If we are currently playing a channel, stop it.
            this.stop();
        }

        var channel;
        var componentData = this.data;
        if (componentData.sources[name]) {
            if (!componentData['3d']) {
                channel = this.system.manager.playSound(componentData.sources[name], componentData);
                componentData.currentSource = name;
                componentData.channel = channel;
            } else {
                var pos = this.entity.getPosition();
                channel = this.system.manager.playSound3d(componentData.sources[name], pos, componentData);
                componentData.currentSource = name;
                componentData.channel = channel;
            }
        }
    }

    /**
     * @private
     * @function
     * @name AudioSourceComponent#pause
     * @description Pause playback of the audio that is playing on the Entity. Playback can be resumed by calling {@link pc.AudioSourceComponent#unpause}.
     */
    pause() {
        if (this.channel) {
            this.channel.pause();
        }
    }

    /**
     * @private
     * @function
     * @name AudioSourceComponent#unpause
     * @description Resume playback of the audio if paused. Playback is resumed at the time it was paused.
     */
    unpause() {
        if (this.channel && this.channel.paused) {
            this.channel.unpause();
        }
    }

    /**
     * @private
     * @function
     * @name AudioSourceComponent#stop
     * @description Stop playback on an Entity. Playback can not be resumed after being stopped.
     */
    stop() {
        if (this.channel) {
            this.channel.stop();
            this.channel = null;
        }
    }

    onSetAssets(name, oldValue, newValue) {
        var newAssets = [];
        var i, len = newValue.length;

        if (oldValue && oldValue.length) {
            for (i = 0; i < oldValue.length; i++) {
                // unsubscribe from change event for old assets
                if (oldValue[i]) {
                    var asset = this.system.app.assets.get(oldValue[i]);
                    if (asset) {
                        asset.off('change', this.onAssetChanged, this);
                        asset.off('remove', this.onAssetRemoved, this);

                        if (this.currentSource === asset.name) {
                            this.stop();
                        }
                    }
                }
            }
        }

        if (len) {
            for (i = 0; i < len; i++) {
                if (oldValue.indexOf(newValue[i]) < 0) {
                    if (newValue[i] instanceof Asset) {
                        newAssets.push(newValue[i].id);
                    } else {
                        newAssets.push(newValue[i]);
                    }

                }
            }
        }

        if (!this.system._inTools && newAssets.length) { // Only load audio data if we are not in the tools and if changes have been made
            this.loadAudioSourceAssets(newAssets);
        }
    }

    onAssetChanged(asset, attribute, newValue, oldValue) {
        if (attribute === 'resource') {
            var sources = this.data.sources;
            if (sources) {
                this.data.sources[asset.name] = newValue;
                if (this.data.currentSource === asset.name) {
                    // replace current sound if necessary
                    if (this.channel) {
                        if (this.channel.paused) {
                            this.play(asset.name);
                            this.pause();
                        } else {
                            this.play(asset.name);
                        }
                    }
                }
            }
        }
    }

    onAssetRemoved(asset) {
        asset.off('remove', this.onAssetRemoved, this);
        if (this.data.sources[asset.name]) {
            delete this.data.sources[asset.name];
            if (this.data.currentSource === asset.name) {
                this.stop();
                this.data.currentSource = null;
            }
        }
    }

    onSetLoop(name, oldValue, newValue) {
        if (oldValue != newValue) {
            if (this.channel) {
                this.channel.setLoop(newValue);
            }
        }
    }

    onSetVolume(name, oldValue, newValue) {
        if (oldValue != newValue) {
            if (this.channel) {
                this.channel.setVolume(newValue);
            }
        }
    }

    onSetPitch(name, oldValue, newValue) {
        if (oldValue != newValue) {
            if (this.channel) {
                this.channel.setPitch(newValue);
            }
        }
    }

    onSetMaxDistance(name, oldValue, newValue) {
        if (oldValue != newValue) {
            if (this.channel instanceof Channel3d) {
                this.channel.setMaxDistance(newValue);
            }
        }
    }

    onSetMinDistance(name, oldValue, newValue) {
        if (oldValue != newValue) {
            if (this.channel instanceof Channel3d) {
                this.channel.setMinDistance(newValue);
            }
        }
    }

    onSetRollOffFactor(name, oldValue, newValue) {
        if (oldValue != newValue) {
            if (this.channel instanceof Channel3d) {
                this.channel.setRollOffFactor(newValue);
            }
        }
    }

    onSetDistanceModel(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (this.channel instanceof Channel3d) {
                this.channel.setDistanceModel(newValue);
            }
        }
    }

    onSet3d(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (this.system.initialized && this.currentSource) {
                var paused = false;
                var suspended = false;
                if (this.channel) {
                    paused = this.channel.paused;
                    suspended = this.channel.suspended;
                }

                this.play(this.currentSource);

                if (this.channel) {
                    this.channel.paused = paused;
                    this.channel.suspended = suspended;
                }
            }
        }
    }

    onEnable() {
        // load assets that haven't been loaded yet
        var assets = this.data.assets;
        if (assets) {
            var registry = this.system.app.assets;

            for (var i = 0, len = assets.length; i < len; i++) {
                var asset = assets[i];
                if (!(asset instanceof Asset))
                    asset = registry.get(asset);

                if (asset && !asset.resource) {
                    registry.load(asset);
                }
            }
        }

        if (this.system.initialized) {
            if (this.data.activate && !this.channel) {
                this.play(this.currentSource);
            } else {
                this.unpause();
            }
        }
    }

    onDisable() {
        this.pause();
    }

    loadAudioSourceAssets(ids) {
        var self = this;

        var assets = ids.map(function (id) {
            return this.system.app.assets.get(id);
        }, this);

        var sources = {};
        var currentSource = null;

        var count = assets.length;

        // make sure progress continues even if some audio doesn't load
        var _error = function (e) {
            count--;
        };

        // once all assets are accounted for continue
        var _done = function () {
            this.data.sources = sources;
            this.data.currentSource = currentSource;

            if (this.enabled && this.activate && currentSource) {
                this.onEnable();
            }
        }.bind(this);

        assets.forEach(function (asset, index) {
            if (asset) {
                // set the current source to the first entry (before calling set, so that it can play if needed)
                currentSource = currentSource || asset.name;

                // subscribe to change events to reload sounds if necessary
                asset.off('change', this.onAssetChanged, this);
                asset.on('change', this.onAssetChanged, this);

                asset.off('remove', this.onAssetRemoved, this);
                asset.on('remove', this.onAssetRemoved, this);

                asset.off('error', _error, this);
                asset.on('error', _error, this);
                asset.ready(function (asset) {
                    sources[asset.name] = asset.resource;
                    count--;
                    if (count === 0) {
                        _done();
                    }
                });

                if (!asset.resource && self.enabled && self.entity.enabled)
                    this.system.app.assets.load(asset);
            } else {
                // don't wait for assets that aren't in the registry
                count--;
                if (count === 0) {
                    _done();
                }
                // but if they are added insert them into source list
                this.system.app.assets.on("add:" + ids[index], function (asset) {
                    asset.ready(function (asset) {
                        self.data.sources[asset.name] = asset.resource;
                    });

                    if (!asset.resource)
                        self.system.app.assets.load(asset);
                });
            }
        }, this);
    }
}

export { AudioSourceComponent };
