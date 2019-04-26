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
        }
    };

    return {
        TemplateUtils: TemplateUtils
    };
}());
