import { Render } from '../scene/render.js';

/**
 * @class
 * @name pc.RenderHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.Model} resources.
 * @param {pc.GraphicsDevice} device - The graphics device that will be rendering.
 * @param {pc.StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
 */
function RenderHandler(assets) {
    this._registry = assets;
}

// The scope of this function is the render asset
function onContainerAssetLoaded(containerAsset) {
    var renderAsset = this;
    if (!renderAsset.resource) return;

    var containerResource = containerAsset.resource;

    var render = containerResource.renders && containerResource.renders[renderAsset.data.renderIndex];
    if (render) {
        renderAsset.resource.meshes = render.resource;
    }
}

// The scope of this function is the render asset
function onContainerAssetAdded(containerAsset) {
    var renderAsset = this;

    renderAsset.registry.off('load:' + containerAsset.id, onContainerAssetLoaded, renderAsset);
    renderAsset.registry.on('load:' + containerAsset.id, onContainerAssetLoaded, renderAsset);

    if (!containerAsset.resource) {
        renderAsset.registry.load(containerAsset);
    } else {
        onContainerAssetLoaded.call(renderAsset, containerAsset);
    }
}

Object.assign(RenderHandler.prototype, {
    load: function (url, callback, asset) {
    },

    open: function (url, data) {
        return new Render();
    },

    patch: function (asset, registry) {
        if (!asset.data.containerAsset)
            return;

        var containerAsset = registry.get(asset.data.containerAsset);
        if (!containerAsset) {
            registry.once('add:' + containerAsset.id, onContainerAssetAdded, asset);
            return;
        }

        onContainerAssetAdded.call(asset, containerAsset);
    }
});

export { RenderHandler };
