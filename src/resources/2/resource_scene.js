pc.extend(pc, function () {
    'use strict';

    var SceneHandler = function (app) {
        this._app = app;
    };

    SceneHandler.prototype = {
        load: function (url, callback) {
            pc.net.http.get(url, function (response) {
                callback(null, response);
            }, {
                error: function (status, xhr, e) {
                    callback("Error requesting scene: " + url);
                }
            })
        },

        open: function (url, data) {
            var scene = new pc.Scene();
            this._app.scene = scene;

            var entities = {};
            var id, i;
            var parent = null;

            // instantiate entities
            for (id in data['entities']) {
                entities[id] = this._createEntity(data['entities'][id]);
                if (data['entities'][id].parent === null) {
                    parent = entities[id];
                }
            }

            // put entities into hierarchy
            for(id in data['entities']) {
                var entity = entities[id];

                var l = data['entities'][id]['children'].length;
                for (i = 0; i < l; i++) {
                    // pop resource id off the end of the array
                    var resource_id = data['entities'][id]['children'][i];
                    if (entities[resource_id]) {
                        // push entity on the front of the array
                        entities[id].addChild(entities[resource_id]);
                    }
                }
            }

            this._openComponentData(parent, data.entities);

            // set scene root
            scene.root = parent;

            // settings
            scene._gravity.set(data.settings.physics.gravity[0], data.settings.physics.gravity[1], data.settings.physics.gravity[2]);

            var al = data.settings.render.global_ambient;
            scene.ambientLight = new pc.Color(al[0], al[1], al[2]);

            scene.fog = data.settings.render.fog;
            var fogColor = data.settings.render.fog_color;
            scene.fogColor = new pc.Color(fogColor[0], fogColor[1], fogColor[2]);
            scene.fogStart = data.settings.render.fog_start;
            scene.fogEnd = data.settings.render.fog_end;
            scene.fogDensity = data.settings.render.fog_density;
            scene.gammaCorrection = data.settings.render.gamma_correction;
            scene.toneMapping = data.settings.render.tonemapping;
            scene.exposure = data.settings.render.exposure;
            scene.skyboxIntensity = data.settings.render.skyboxIntensity===undefined? 1 : data.settings.render.skyboxIntensity;
            scene.skyboxMip = data.settings.render.skyboxMip===undefined? 0 : data.settings.render.skyboxMip;

            scene.skyboxAsset = data.settings.render.skybox;

            return scene;
        },

        patch: function (asset, assets) {
            var scene = asset.resource;

            var asset = assets.get(scene.skyboxAsset);

            if (asset) {
                asset.ready(function(asset) {
                    scene.attachSkyboxAsset(asset);

                    asset.on('change', this._onSkyBoxChanged, this);
                    asset.on('remove', this._onSkyBoxRemoved, this);
                });
            } else {
                assets.once("add:" + scene.skyboxAsset, function (asset) {
                    asset.ready(function (asset) {
                        scene.attachSkyboxAsset(asset);
                    });
                });
            }
        },

        _createEntity: function (data) {
            var entity = new pc.Entity();

            var p = data.position;
            var r = data.rotation;
            var s = data.scale;

            entity.setName(data.name);
            entity.setGuid(data.resource_id);
            entity.setLocalPosition(p[0], p[1], p[2]);
            entity.setLocalEulerAngles(r[0], r[1], r[2]);
            entity.setLocalScale(s[0], s[1], s[2]);
            entity._enabled = data.enabled !== undefined ? data.enabled : true;
            entity._enabledInHierarchy = entity._enabled;
            entity.template = data.template;

            if (data.labels) {
                data.labels.forEach(function (label) {
                    entity.addLabel(label);
                });
            }

            return entity;
        },

        _openComponentData: function (entity, entities) {
            // Create Components in order
            var systems = this._app.systems.list();
            var i, len = systems.length;
            var edata = entities[entity.getGuid()];
            for (i = 0; i < len; i++) {
                var componentData = edata.components[systems[i].id];
                if (componentData) {
                    this._app.systems[systems[i].id].addComponent(entity, componentData);
                }
            }

            // Open all children and add them to the node
            var child, length = edata.children.length;
            var children = entity.getChildren();
            for (i = 0; i < length; i++) {
                children[i] = this._openComponentData(children[i], entities);
            }

            return entity;
        }
    };

    return {
        SceneHandler: SceneHandler
    }
}());
