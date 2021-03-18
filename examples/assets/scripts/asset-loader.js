// asset loader function allowing to load multiple assets
function loadManifestAssets(app, manifest, onLoaded) {
    // count of assets to load
    var count = 0;
    var key;
    for (key in manifest) {
        if (manifest.hasOwnProperty(key)) {
            count++;
        }
    }
    // load them all
    Object.keys(manifest).forEach(function (key) {
        if (manifest.hasOwnProperty(key)) {
            var entry = manifest[key];
            if (entry.data) {
                var asset = new pc.Asset(key, entry.type, entry.url, entry.data);
                asset.on('load', function (asset) {
                    count--;
                    entry.asset = asset;
                    if (count === 0) {
                        if (onLoaded) {
                            onLoaded();
                        }
                    }
                });
                app.assets.add(asset);
                app.assets.load(asset);
            } else {
                app.assets.loadFromUrl(entry.url, entry.type, function (err, asset) {
                    if (!err && asset) {
                        count--;
                        entry.asset = asset;
                        if (count === 0) {
                            if (onLoaded) {
                                onLoaded();
                            }
                        }
                    }
                });
            }
        }
    });
}
