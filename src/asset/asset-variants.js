const properties = [];

class AssetVariants {
    constructor(asset) {
        this.asset = asset;
    }

    clear() {
        for (let i = 0; i < properties.length; i++)
            this[properties[i]] = null;
    }
}

function defineVariantProperty(name) {
    const field = '_' + name;
    properties.push(field);

    Object.defineProperty(AssetVariants.prototype, name, {
        get: function () {
            return this[field] || null;
        },
        set: function (value) {
            const fieldAsBool = !!this[field];
            const valueAsBool = !!value;
            if (fieldAsBool !== valueAsBool || (this[field] && value && this[field].hash !== value.hash)) {
                if (value) {
                    this[field] = {
                        url: value.url,
                        filename: value.filename,
                        size: value.size,
                        hash: value.hash,
                        opt: value.opt || 0
                    };
                } else {
                    this[field] = null;
                }

                if (this.asset.file) {
                    this.asset.fire('change', this.asset, 'file', this.asset._file, this.asset._file);
                    this.asset.reload();
                }
            }
        }
    });
}

// texture
defineVariantProperty('dxt');
defineVariantProperty('pvr');
defineVariantProperty('etc1');
defineVariantProperty('etc2');
defineVariantProperty('basis');

export { AssetVariants };
