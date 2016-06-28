pc.extend(pc, function () {
    'use strict';

    var SceneParser = function (app) {
        this._app = app;
    };

    SceneParser.prototype = {
        parse: function (data) {
            var entities = {};
            var id, i;
            var parent = null;

            // instantiate entities
            for (id in data.entities) {
                entities[id] = this._createEntity(data.entities[id]);
                if (data.entities[id].parent === null) {
                    parent = entities[id];
                }
            }

            // put entities into hierarchy
            for(id in data.entities) {
                var entity = entities[id];

                var l = data.entities[id].children.length;
                for (i = 0; i < l; i++) {
                    // pop resource id off the end of the array
                    var resource_id = data.entities[id].children[i];
                    if (entities[resource_id]) {
                        // push entity on the front of the array
                        entities[id].addChild(entities[resource_id]);
                    }
                }
            }

            this._openComponentData(parent, data.entities);

            return parent;
        },

        _createEntity: function (data) {
            var entity = new pc.Entity();

            var p = data.position;
            var r = data.rotation;
            var s = data.scale;

            entity.name = data.name;
            entity._guid = data.resource_id;
            entity.setLocalPosition(p[0], p[1], p[2]);
            entity.setLocalEulerAngles(r[0], r[1], r[2]);
            entity.setLocalScale(s[0], s[1], s[2]);
            entity._enabled = data.enabled !== undefined ? data.enabled : true;
            entity._enabledInHierarchy = entity._enabled;
            entity.template = data.template;

            if (data.tags) {
                for(var i = 0; i < data.tags.length; i++) {
                    entity.tags.add(data.tags[i]);
                }
            }

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
            var edata = entities[entity._guid];
            for (i = 0; i < len; i++) {
                var componentData = edata.components[systems[i].id];
                if (componentData) {
                    this._app.systems[systems[i].id].addComponent(entity, componentData);
                }
            }

            // Open all children and add them to the node
            var child, length = edata.children.length;
            var children = entity._children;
            for (i = 0; i < length; i++) {
                children[i] = this._openComponentData(children[i], entities);
            }

            return entity;
        }
    };

    return {
        SceneParser: SceneParser
    };
}());
