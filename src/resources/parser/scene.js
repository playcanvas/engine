import { Entity } from '../../framework/entity.js';

import { CompressUtils } from '../../compress/compress-utils';
import { Decompress } from '../../compress/decompress';

class SceneParser {
    constructor(app, isTemplate) {
        this._app = app;

        this._isTemplate = isTemplate;
    }

    parse(data) {
        var entities = {};
        var id, i, curEnt;
        var parent = null;

        var compressed = data.compressedFormat;
        if (compressed) {
            data.entities = new Decompress(data.entities, compressed).run();
        }

        // instantiate entities
        for (id in data.entities) {
            var curData = data.entities[id];
            curEnt = this._createEntity(curData, compressed);
            entities[id] = curEnt;
            if (curData.parent === null) {
                parent = curEnt;
            }
        }

        // put entities into hierarchy
        for (id in data.entities) {
            curEnt = entities[id];
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

        delete data.compressedFormat;

        return parent;
    }

    _createEntity(data, compressed) {
        var entity = new Entity();

        entity.name = data.name;
        entity.setGuid(data.resource_id);
        this._setPosRotScale(entity, data, compressed);
        entity._enabled = data.enabled !== undefined ? data.enabled : true;

        if (this._isTemplate) {
            entity._template = true;
        } else {
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
    }

    _setPosRotScale(entity, data, compressed) {
        if (compressed) {
            CompressUtils.setCompressedPRS(entity, data, compressed);

        } else {
            var p = data.position;
            var r = data.rotation;
            var s = data.scale;

            entity.setLocalPosition(p[0], p[1], p[2]);
            entity.setLocalEulerAngles(r[0], r[1], r[2]);
            entity.setLocalScale(s[0], s[1], s[2]);
        }
    }

    _openComponentData(entity, entities) {
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
}

export { SceneParser };
