Object.assign(pc, function () {

    var TemplateUtils = {
        extractTemplateIds: function(entities) {
            var templateIds = [];

            for (var guid in entities) {
                var id = entities[guid].template_id;

                if (id) {
                    templateIds.push(id);
                }
            }

            return templateIds;
        },

        // todo: return a new object, not 'data', which will not have 'collapsed' flags
        // todo: replace this with an actual traversal-based tree-copy
        expandEntity: function (app, data) {
            var template = app.assets.get(data.template_id);

            // todo: replace this with an actual traversal-based tree-copy

            var h = JSON.parse(JSON.stringify(template.resource.origJson));

            var instId = data.resource_id;

            var parent = data.parent;

            var templId = Object.keys(h.entities)[0];

            Object.assign(data, h.entities[templId]);

            data.resource_id = instId;

            data.parent = parent;

            data.collapsed_template = false;

            return data;
        }
    };

    return {
        TemplateUtils: TemplateUtils
    };
}());
