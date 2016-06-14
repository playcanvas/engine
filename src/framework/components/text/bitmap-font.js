pc.extend(pc, function () {
    // Bitmap texture based font
    //
    var BitmapFont = function () {
        // atlas texture
        this.texture = null;
        // json data
        this.data = null;

        this._textureAsset = null;
        this._dataAsset = null;

        pc.events.attach(this);
    };

    BitmapFont.prototype = {
        set: function (texture, data) {
            if (texture instanceof pc.Texture) {
                this.texture = texture;
            }
        },

        load: function (app, textureId, dataId) {
            // remove existing events
            if (this._textureAsset) {
                this._textureAsset.off('load', this._onTextureLoad, this);
            }
            if (this._dataAsset) {
                this._dataAsset.off('load', this._onDataLoad, this);
            }

            this._textureAsset = app.assets.get(textureId);
            if (this._textureAsset) {
                if (this._textureAsset.resource) {
                    this.texture = this._textureAsset.resource;
                } else {
                    this._textureAsset.on('load', this._onTextureLoad, this);
                    app.assets.load(this._textureAsset);
                }
            }

            this._dataAsset = app.assets.get(dataId);
            if (this._dataAsset) {
                if (this._dataAsset.resource) {
                    this.data = this._dataAsset.resource;
                } else {
                    this._dataAsset.on('load', this._onDataLoad, this);
                    app.assets.load(this._dataAsset);
                }
            }

            // check to see if loading is complete
            this._check();
        },

        _onTextureLoad: function (asset) {
            this.texture = asset.resource;
            this._check();
        },

        _onDataLoad: function (asset) {
            this.data = asset.resource;
            this._check();
        },

        _check: function () {
            if (this.texture && this.data) {
                // loading is complete
                this.fire("load", this);
            }
        }
    }
    return {
        BitmapFont: BitmapFont
    }
}());
