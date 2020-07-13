import { Entity } from '../../framework/entity.js';

import { TemplateUtils } from '../../templates/template-utils.js';

function SceneParser(app, isTemplate) {
    this._app = app;

    this._isTemplate = isTemplate;
}

Object.assign(SceneParser.prototype, {
    parse: function (data) {
        var entities = {};
        var id, i;
        var parent = null;

        if (data.collapsedInstances) {
            this._addCollapsedToEntities(this._app, data);
        }

        // instantiate entities
        for (id in data.entities) {
            var curData = data.entities[id];
            var curEnt = this._createEntity(curData);
            entities[id] = curEnt;
            if (curData.parent === null) {
                parent = curEnt;
            }
        }

        // put entities into hierarchy
        for (id in data.entities) {
            var curEnt = entities[id];
            var children = data.entities[id].children;
            var len = children.length;
            for (i = 0; i < len; i++) {
                var childEnt = entities[children[i]];
                if (childEnt) {
                    curEnt.addChild(childEnt);
                }
            }
        }

        this._openComponentData(parent, data.entities);

        return parent;
    },

    _createEntity: function (data) {
        var entity = new Entity();

        var p = data.position;
        var r = data.rotation;
        var s = data.scale;

        entity.name = data.name;
        entity.setGuid(data.resource_id);
        entity.setLocalPosition(p[0], p[1], p[2]);
        entity.setLocalEulerAngles(r[0], r[1], r[2]);
        entity.setLocalScale(s[0], s[1], s[2]);
        entity._enabled = data.enabled !== undefined ? data.enabled : true;

        if (!this._isTemplate) {
            entity._enabledInHierarchy = entity._enabled;
        }

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
    },

    _addCollapsedToEntities: function (app, data) {
        data.collapsedInstances.forEach(function (h) {
            var expanded = TemplateUtils.expandTemplateEntities(
                app, h.instanceEntities);

            Object.assign(data.entities, expanded);
        });
    }
});

export { SceneParser };
