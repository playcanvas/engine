Object.assign(pc, function () {

    /**
     * @class
     * @name pc.BasisParser
     * @implements {pc.TextureParser}
     * @classdesc Parser for basis files.
     */
    var BasisParser = function (registry, retryRequests) {
        this.retryRequests = !!retryRequests;
    };

    Object.assign(BasisParser.prototype, {
        load: function (url, callback, asset) {
            var options = {
                cache: true,
                responseType: "arraybuffer",
                retry: this.retryRequests
            };
            pc.http.get(
                url.load,
                options,
                function (err, result) {
                    if (err) {
                        callback(err, result);
                    } else {
                        // massive hack for pvr textures (i.e. apple devices)
                        // the quality of GGGR normal maps under PVR compression is still terrible
                        // so here we instruct the basis transcoder to unswizzle the normal map data
                        // and pack to 565
                        var unswizzleGGGR = pc.basisTargetFormat() === 'pvr' &&
                                            asset && asset.file && asset.file.variants &&
                                            asset.file.variants.basis &&
                                            ((asset.file.variants.basis.opt & 8) !== 0);
                        if (unswizzleGGGR) {
                            // remove the swizzled flag from the asset
                            asset.file.variants.basis.opt &= ~8;
                        }
                        pc.basisTranscode(url.load, result, callback, { unswizzleGGGR: unswizzleGGGR });
                    }
                }
            );
        },

        // our async transcode call provides the neat structure we need to create the texture instance
        open: function (url, data, device) {
            var texture = new pc.Texture(device, {
                name: url,
                // #ifdef PROFILER
                profilerHint: pc.TEXHINT_ASSET,
                // #endif
                addressU: data.cubemap ? pc.ADDRESS_CLAMP_TO_EDGE : pc.ADDRESS_REPEAT,
                addressV: data.cubemap ? pc.ADDRESS_CLAMP_TO_EDGE : pc.ADDRESS_REPEAT,
                width: data.width,
                height: data.height,
                format: data.format,
                cubemap: data.cubemap,
                levels: data.levels
            });

            texture.upload();

            return texture;
        }
    });

    return {
        BasisParser: BasisParser
    };
}());
