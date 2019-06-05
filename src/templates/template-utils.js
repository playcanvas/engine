Object.assign(pc, function () {

    var TemplateUtils = {
        waitForTemplatesInScene: function(data, assets, callback) {
            if (data.collapsedInstances) {
                var entities = pc.TemplateUtils._getAllCollapsedEntities(data);

                pc.TemplateUtils.waitForTemplateAssets(
                    entities,
                    assets,
                    callback,
                    data);
            } else {
                callback(null, response);
            }
        },

        waitForTemplateAssets: function(entities, assets, callback, response) {
            var templateIds = pc.TemplateUtils._extractTemplateIds(entities);

            var loader = new pc.AssetListLoader(templateIds, assets);

            loader.load(function (err) {
                callback(err, response);
            });
        },

        _getAllCollapsedEntities: function(data) {
            var entities = {};

            data.collapsedInstances.forEach(function (h) {
                Object.assign(entities, h.instanceEntities);
            });

            return entities;
        },

        _extractTemplateIds: function (entities) {
            var templateIds = [];

            for (var guid in entities) {
                var id = entities[guid].template_id;

                if (id) {
                    templateIds.push(id);
                }
            }

            return templateIds;
        },

        expandTemplateEntities: function (app, entities) {
            var result = {};

            for (var guid in entities) {
                var h = entities[guid];

                result[guid] = h.collapsed_template ?
                    pc.TemplateUtils.expandEntity(app, h) : h;
            }

            return result;
        },

        // todo: return a new object, not 'data', which will not have 'collapsed' flags
        // todo: replace this with an actual traversal-based tree-copy
        expandEntity: function (app, data) {
            var template = app.assets.get(data.template_id);

            // todo: code below is only for testing, replace this with an actual traversal-based tree-copy

            var h = JSON.parse(JSON.stringify(template.resource.getExpandedData()));

            var instId = data.resource_id;

            var parent = data.parent;

            var templId = Object.keys(h.entities)[0];

            var result = Object.assign({}, data, h.entities[templId]);

            result.resource_id = instId;

            result.parent = parent;

            result.collapsed_template = false;

            return result;
        }
    };

    return {
        TemplateUtils: TemplateUtils
    };
}());
