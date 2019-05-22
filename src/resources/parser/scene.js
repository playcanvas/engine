Object.assign(pc, function () {
    'use strict';

    var SceneParser = function (app) {
        this._app = app;
        this.entities = {};
        this.parent = null;
    };

    Object.assign(SceneParser.prototype, {
        parse: function (data) {
            this._createAllEntities(data);

            for (var id in data.entities) {
                this._addChildren(id, data.entities[id].children);
            }

            this._openComponentData(this.parent, data.entities);

            return this.parent;
        },

        _createAllEntities: function(data) {
            var ids = Object.keys(data.entities);

            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];

                var entity = this._handleEntityJson(id, data);

                if (entity) {
                    this.entities[id] = entity;

                    if (data.entities[id].parent === null) {
                        this.parent = entity;
                    }
                }
            }
        },

        _handleEntityJson: function(id, data) {
            var h = data.entities[id];

            if (h.collapsed_template_in_scene) {
                delete data.entities[id];

                new pc.AsyncTemplateLoad(this._app, h).run();

                return null;
            }

            if (h.collapsed_template) {// todo: rename the flag to collapsed_template_in_asset
                data.entities[id] = pc.TemplateUtils.expandEntity(this._app, h);
            }

            return this._createEntity(data.entities[id]);
        },

        _createEntity: function (data) {
            var entity = new pc.Entity();

            var p = data.position;
            var r = data.rotation;
            var s = data.scale;

            entity.name = data.name;
            entity.setGuid(data.resource_id);
            entity.setLocalPosition(p[0], p[1], p[2]);
            entity.setLocalEulerAngles(r[0], r[1], r[2]);
            entity.setLocalScale(s[0], s[1], s[2]);
            entity._enabled = data.enabled !== undefined ? data.enabled : true;
            //entity._enabledInHierarchy = entity._enabled; // disable for all
            entity.template = data.template;

            if (data.tags) {
                for (var i = 0; i < data.tags.length; i++) {
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

        _addChildren: function(id, children) {
            for (var i = 0; i < children.length; i++) {
                var chId = children[i];

                if (this.entities[chId]) {
                    this.entities[id].addChild(this.entities[chId]);
                }
            }
        },

        _openComponentData: function (entity, entities) {
            // Create components in order
            var systemsList = this._app.systems.list;

            var i, len = systemsList.length;
            var entityData = entities[entity.getGuid()];
            for (i = 0; i < len; i++) {
                var system = systemsList[i];
                var componentData = entityData.components[system.id];
                if (componentData) {
                    system.addComponent(entity, componentData);
                }
            }

            // Open all children and add them to the node
            len = entityData.children.length;
            var children = entity._children;
            for (i = 0; i < len; i++) {
                children[i] = this._openComponentData(children[i], entities);
            }

            return entity;
        }
    });

    return {
        SceneParser: SceneParser
    };
}());
