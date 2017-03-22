//
// This is an example implementation of how you might
// extend PlayCanvas entities to support clicking/picking.
// To use:
//
// - Create an instance of SelectionManager
//
//    var selectionManager = new SelectionManager(app, device);
//    selectionManager.attach(app); // start listening for events
//
// - When you create a new Entity add:
//
//    entity.selector = new Selector(entity, selectionManager);
//
// - To listen for events:
//
//    entity.selector.on("pointerdown", function (x, y) {//...});
//
SelectionManager = function (app, device) {
    this._app = app;
    this._device = device;

    this._width = 1024;
    this._height = 1024;
    this._picker = new pc.Picker(device, this._width, this._height);

    this._rect = {x: 0, y: 0, width:0, height: 0};

    this._prepared = false;

    this._events = {};

    // list of items the pointer is over
    this._over = [null];

    // is the pointer down
    this._down = [false];
};


SelectionManager.prototype = {
    attach: function (app) {
        if (app.mouse) {
            app.mouse.on('mousedown', this._onMouseDown, this);
            app.mouse.on('mouseup', this._onMouseUp, this);
            app.mouse.on('mousemove', this._onMouseMove, this);
        }

        if (app.touch) {
            app.touch.on('touchstart', this._onTouchStart, this);
            app.touch.on('touchend', this._onTouchEnd, this);
            app.touch.on('touchmove', this._onTouchMove, this);
            app.touch.on('touchcancel', this._onTouchCancel, this);
        }
    },

    select: function (x, y, width, height) {
        if (!this._prepared) {
            this._picker.prepare(this.camera, this._app.scene);
        }

        this._rect.x = x * this._picker.width / this._app.graphicsDevice.canvas.clientWidth;;
        this._rect.y = this._picker.height - Math.floor(y*this._picker.height/this._app.graphicsDevice.canvas.clientHeight);;
        if (width && height) {
            this._rect.width = width;
            this._rect.height = height;
        } else {
            this._rect.width = 0;
            this._rect.height = 0;
        }

        var results = this._picker.getSelection(this._rect);
        if (results.length > 0) {
            var meshInstance = results[0];

            // walk up hierarchy to find Entity
            var node = meshInstance.node;
            while(node && !(node instanceof pc.Entity)) {
                node = node._parent;
            }

            return node;
        }
        return null;
    },


    addEvent: function (name) {
        if (this._events[name] === undefined) this._events[name] = 0;
        this._events[name]++;
    },

    removeEvent: function (name) {
        this._events[name]--;
    },

    _onMouseDown: function (e) {
        if (!this._events['pointerdown']) return;

        var tapId = 0;

        var entity = this.select(e.x, e.y);
        if (entity && entity.selector) {
            entity.selector.fire("pointerdown", e.x, e.y);
        }

        this._down[tapId] = entity;
    },

    _onMouseUp: function (e) {
        if (!this._events['pointerup']) return;

        var entity = this.select(e.x, e.y);
        if (entity && entity.selector) {
            entity.selector.fire('pointerup', e.x, e.y);
            entity.selector.fire('pointerclick', e.x, e.y);
        }

        var tapId = 0;
        this._down[tapId] = null;
    },

    _onMouseMove: function (e) {
        if (!this._events['pointerenter'] && !this._events['pointerexit'] && !this._events['pointermove']) return;

        var tapId = 0;

        var entity = this.select(e.x, e.y);
        var current = this._over[tapId];

        if (entity && (!current || current !== entity)) {
            // new entity
            if (entity.selector) entity.selector.fire('pointerenter', e.x, e.y);
            if (current) {
                // leave current
                current.selector.fire('pointerleave', e.x, e.y);
            }
        } else if (entity && entity.selector && entity === current) {
            // move over existing entity
            entity.selector.fire('pointermove', e.x, e.y);
        } else if (!entity && current) {
            current.selector.fire('pointerleave', e.x, e.y);
        }

        if (entity && entity.selector) {
            this._over[tapId] = entity;
        } else {
            this._over[tapId] = null;
        }
    },

    _onTouchStart: function (e) {
        if (!this._events['pointerdown']) return;

        var tapId = 0;
        var touch = e.changedTouches[tapId];

        var entity = this.select(touch.x, touch.y);
        if (entity && entity.selector) {
            entity.selector.fire('pointerdown', touch.x, touch.y);
        }

        this._down[tapId] = entity;
    },

    _onTouchEnd: function (e) {
        if (!this._events['pointerup'] && !this._events['pointerclick']) return;

        var tapId = 0;
        var touch = e.changedTouches[tapId];

        var entity = this.select(touch.x, touch.y);
        if (entity && entity.selector) {
            entity.selector.fire('pointerup', touch.x, touch.y);
            entity.selector.fire('pointerclick', touch.x, touch.y);
        }

        this._down[tapId] = null;
    },

    _onTouchCancel: function (e) {
        if (!this._events['pointerup'] && !this._events['pointerclick']) return;

        var tapId = 0;
        var touch = e.changedTouches[tapId];

        var entity = this.select(touch.x, touch.y);
        if (entity && entity.selector) {
            entity.selector.fire('pointerup', touch.x, touch.y);
        }

        this._down[tapId] = null;
    },

    _onTouchMove: function (e) {
        if (!this._events['pointerenter'] && !this._events['pointerexit']) return;

        var tapId = 0;
        var touch = e.changedTouches[tapId];

        var entity = this.select(touch.x, touch.y);
        var current = this._over[tapId];

        if (entity && entity.selector && (!current || current !== entity)) {
            // new entity
            entity.selector.fire('pointerenter', touch.x, touch.y);
            if (current) {
                // leave current
                current.selector.fire('pointerleave', touch.x, touch.y);
            }
        } else if (entity && entity.selector && entity === current) {
            // move over existing entity
            entity.selector.fire('pointermove', touch.x, touch.y);
        } else if (!entity && current) {
            current.selector.fire('pointerleave', touch.x, touch.y);
        }

        if (entity && entity.selector) {
            this._over[tapId] = entity;
        } else {
            this._over[tapId] = null;
        }
    }
}

Object.defineProperty(SelectionManager.prototype, 'camera', {
    get: function () {
        if (!this._camera) {
            this._camera = this._app.systems.camera.cameras[0].camera;
        }
        return this._camera;
    },

    set: function (value) {
        this._camera = value;
    }
});


var Selector = function (entity, selectionManager) {
    this.entity = entity;
    this._manager = selectionManager;
    this._tap = -1;

    pc.events.attach(Selector.prototype);

    this.on = function (name, callback, scope) {
        this._manager.addEvent(name);
        Selector.prototype.on.call(this, name, callback, scope);
    }
};


Object.defineProperty(Selector.prototype, "isPointerDown", {
    get: function () {
        for (var i = 0; i < this._manager._down.length; i++) {
            if (this._manager._down[i] === this.entity) return true;
        }
        return false;
    }
});
