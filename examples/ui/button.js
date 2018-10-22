//
// This is a sample implementation of a User Interface Button
// Using the engine screen/element systems and the SelectionManager script
//
// To use add a script component with the 'button' script
// and add textures for each state:


var Button = pc.createScript('button');

Button.attributes.add("defaultTexture", {type: "asset", assetType: "texture"});
Button.attributes.add("defaultUvs", {type: "vec4", default: [0,0,1,1]});
Button.attributes.add("hoverTexture", {type: "asset", assetType: "texture"});
Button.attributes.add("hoverUvs", {type: "vec4", default: [0,0,1,1]});
Button.attributes.add("activatedTexture", {type: "asset", assetType: "texture"});
Button.attributes.add("activatedUvs", {type: "vec4", default: [0,0,1,1]});
Button.attributes.add("disabledTexture", {type: "asset", assetType: "texture"});
Button.attributes.add("disabledUvs", {type: "vec4", default: [0,0,1,1]});

Button.prototype.initialize = function () {
    this.on('activestate', this._onActiveState, this);
    this.on('hoverstate', this._onHoverState, this);
    this.on('disabledstate', this._onDisabledState, this);

    this._active = this._active || false;
    this._hover = this._hover || false;
    this._disabled = this._disabled || false;

    this._onActiveState(this._active);
    this._onHoverState(this._hover);
    this._onDisabledState(this._disabled);

    this.attach();
};

Button.prototype.attach = function () {
    this.entity.selector.on('pointerenter', this._onEnter, this);
    this.entity.selector.on('pointerleave', this._onExit, this);
    this.entity.selector.on('pointerdown', this._onMouseDown, this);
    this.entity.selector.on('pointerup', this._onMouseUp, this);
};

Button.prototype.detach = function () {
    this.entity.selector.off('pointerenter', this._onEnter, this);
    this.entity.selector.off('pointerleave', this._onExit, this);
    this.entity.selector.off('pointerdown', this._onMouseDown, this);
    this.entity.selector.off('pointerup', this._onMouseUp, this);
};

Object.defineProperty(Button.prototype, "hover", {
    get: function () {
        return this._hover;
    },
    set: function (v) {
        if (this._hover !== v) {
            this._hover = v;
            this.fire("hoverstate", this._hover);
        }
    }
});

Object.defineProperty(Button.prototype, "active", {
    get: function () {
        return this._active;
    },
    set: function (v) {
        if (this._active !== v) {
            this._active = v;
            this.fire("activestate", this._active);
        }
    }
});

Object.defineProperty(Button.prototype, "disabled", {
    get: function () {
        return this._disabled;
    },
    set: function (v) {
        if (this._disabled !== v) {
            this._disabled = v;
            this.fire("disabledstate", this._disabled);
        }
    }
});

Button.prototype._onHoverState = function (state) {
    if (this._active) return;
    if (this._disabled) return;

    if (state) {
        this.entity.element.textureAsset = this.hoverTexture;
        this.entity.element.rect = this.hoverUvs;
    } else {
        this.entity.element.textureAsset = this.defaultTexture;
        this.entity.element.rect = this.defaultUvs;
    }
}

Button.prototype._onActiveState = function (state) {
    if (this._disabled) return;

    if (state) {
        this.entity.element.textureAsset = this.activatedTexture;
        this.entity.element.rect = this.activatedUvs;
    } else {
        if (this.hover) {
            this.entity.element.textureAsset = this.hoverTexture;
            this.entity.element.rect = this.hoverUvs
        } else {
            this.entity.element.textureAsset = this.defaultTexture;
            this.entity.element.rect = this.defaultUvs;
        }

    }
}

Button.prototype._onDisabledState = function (state) {
    if (state) {
        this.entity.element.textureAsset = this.disabledTexture;
        this.entity.element.rect = this.disabledUvs;
        this.entity.element.opacity = 0.75;
    } else {
        this.entity.element.opacity = 1;
        if (this.hover) {
            this.entity.element.textureAsset = this.highlightTexture;
            this.entity.element.rect = this.highlightUvs
        } else {
            this.entity.element.textureAsset = this.defaultTexture;
            this.entity.element.rect = this.defaultUvs;
        }
    }
};

Button.prototype._onEnter = function () {
    this.hover = true;
}

Button.prototype._onExit = function () {
    this.hover = false;
    this.active = false;
}

Button.prototype._onMouseDown = function () {
    this.active = true;
}


Button.prototype._onMouseUp = function () {
    this.active = false;
    if (!this._disabled) this.fire('press');
}
