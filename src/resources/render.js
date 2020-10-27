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

Object.assign(RenderHandler.prototype, {
    load: function (url, callback) {
        callback(null, null);
    },

    open: function (url, data) {
        return data;
    },

    processAsset: function (asset, containerAsset, renderIndex) {

        console.log("render handler - processAsset");

        var containerResource = containerAsset.resources[0];
        var renders = containerResource.renders;
        var renderAsset = renders[renderIndex];
        asset.resources = renderAsset.resource;
    },

    loadDependentAsset: function (assets, asset, containerAsset, renderIndex) {

        var self = this;

        // handle the container finished loading
        var onLoad = function (asset, containerAsset, renderIndex) {
            console.log("on container loaded ");


            self.processAsset(asset, containerAsset, renderIndex);
        };

        // handle the container load failure
        var onError = function (err, containerAsset) {
            console.log("on container error: ", err);
        };

        if (!containerAsset.loaded) {

            asset.resource = null;

            // asset is not loaded, register for load and error events
            assets.once('load:' + containerAsset.id, onLoad.bind(self, asset, containerAsset, renderIndex));
            assets.once('error:' + containerAsset.id, onError.bind(self));

            // kick off load if it's not already
            if (!containerAsset.loading) {
                assets.load(containerAsset);
            }
        } else { // container is loaded already

            self.processAsset(asset, containerAsset, renderIndex);
        }
    },

    patch: function (asset, assets) {

        console.log("render handler - patch");

        // this.loadAssets(asset, function (err, result) {
        //     if (err) {
        //         // fire error event if patch failed
        //         registry.fire('error', asset);
        //         registry.fire('error:' + asset.id, err, asset);
        //         asset.fire('error', asset);
        //     }


        //     // nothing to do since asset:change would have been raised if
        //     // resources were changed.
        // });


        // if (!asset.resource)
        //     return;

        var data = asset.data;

        var containerAsset = this._registry.get(data.containerId);
        if (containerAsset) {
            this.loadDependentAsset(assets, asset, containerAsset, data.renderIndex);

            // if (containerAsset.loaded) {
            //     this.processAsset(asset, containerAsset, data.renderIndex);
            // } else {
            //     console.log("need to load container asset ", containerAsset._id);
            //     this.loadDependentAsset(asset);
            // }
        } else {

            // print error that container asset does not exist


            // // if we are unable to find the dependent asset, then we introduce here an
            // // asynchronous step. this gives the caller (for example the scene loader)
            // // a chance to add the dependent scene texture to registry before we attempt
            // // to get the asset again.
            // setTimeout(function (index, assetId_) {
            //     var texAsset = registry.get(assetId_);
            //     if (texAsset) {
            //         processTexAsset(index, texAsset);
            //     } else {
            //         onError(index, "failed to find dependent cubemap asset=" + assetId_);
            //     }
            // }.bind(null, i, assetId));
        }



        // var self = this;
        // asset.resource.meshInstances.forEach(function (meshInstance, i) {
        //     if (data.mapping) {
        //         var handleMaterial = function (asset) {
        //             if (asset.resource) {
        //                 meshInstance.material = asset.resource;
        //             } else {
        //                 asset.once('load', handleMaterial);
        //                 assets.load(asset);
        //             }

        //             asset.once('remove', function (asset) {
        //                 if (meshInstance.material === asset.resource) {
        //                     meshInstance.material = self._defaultMaterial;
        //                 }
        //             });
        //         };

        //         if (!data.mapping[i]) {
        //             meshInstance.material = self._defaultMaterial;
        //             return;
        //         }

        //         var id = data.mapping[i].material;
        //         var url = data.mapping[i].path;
        //         var material;

        //         if (id !== undefined) { // id mapping
        //             if (!id) {
        //                 meshInstance.material = self._defaultMaterial;
        //             } else {
        //                 material = assets.get(id);
        //                 if (material) {
        //                     handleMaterial(material);
        //                 } else {
        //                     assets.once('add:' + id, handleMaterial);
        //                 }
        //             }
        //         } else if (url) {
        //             // url mapping
        //             var path = asset.getAbsoluteUrl(data.mapping[i].path);
        //             material = assets.getByUrl(path);

        //             if (material) {
        //                 handleMaterial(material);
        //             } else {
        //                 assets.once('add:url:' + path, handleMaterial);
        //             }
        //         }
        //     }
        // });
    }
});

export { RenderHandler };
