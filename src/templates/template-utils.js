import { AssetListLoader } from '../asset/asset-list-loader.js';

var TemplateUtils = {
    /**
     * @private
     * @function
     * @name TemplateUtils#waitForTemplatesInScene
     * @description Delay execution of the callback until collapsedInstances
     * are expanded (if present). For expansion we need to wait for template assets
     * to load.
     * @param {object} data - Raw scene data from the database.
     * @param {AssetRegistry} assets - The application's asset registry.
     * @param {Function} callback - The callback to execute after template assets are loaded.
     */
    waitForTemplatesInScene: function (data, assets, callback) {
        if (data.collapsedInstances) {
            var entities = TemplateUtils._getAllCollapsedEntities(data);

            TemplateUtils.waitForTemplateAssets(
                entities,
                assets,
                callback,
                data);
        } else {
            callback(null, data);
        }
    },

    /**
     * @private
     * @function
     * @name TemplateUtils#waitForTemplateAssets
     * @description Delay execution of the callback until template assets
     * referenced by the provided entities are loaded.
     * @param {object[]} entities - Scene entity data from the database.
     * @param {AssetRegistry} assets - The application's asset registry.
     * @param {Function} callback - The callback to execute after template assets are loaded.
     * @param {object} response - The response object to be passed to the callback.
     */
    waitForTemplateAssets: function (entities, assets, callback, response) {
        var templateIds = TemplateUtils._extractTemplateIds(entities);

        var loader = new AssetListLoader(templateIds, assets);

        loader.load(function (err) {
            callback(err, response);
        });
    },

    _getAllCollapsedEntities: function (data) {
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

    /**
     * @private
     * @function
     * @name TemplateUtils#expandTemplateEntities
     * @description Expand entities marked with the collapsed_entity flag.
     * @param {Application} app - The application.
     * @param {object} entities - Scene entity data from the database.
     * @returns {object} An entities map with those that needed expansion expanded.
     */
    expandTemplateEntities: function (app, entities) {
        var result = {};

        for (var guid in entities) {
            var h = entities[guid];

            result[guid] = h.collapsed_entity ?
                TemplateUtils.expandEntity(app, h) : h;
        }

        return result;
    },

    expandEntity: function (app, data) {
        // todo implement this
    }
};

export { TemplateUtils };
