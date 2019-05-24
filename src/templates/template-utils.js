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

            var h = JSON.parse(JSON.stringify(template.resource.origTemplateData));

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
