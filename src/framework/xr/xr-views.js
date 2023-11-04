import { platform } from '../../core/platform.js';
import { EventHandler } from "../../core/event-handler.js";
import { XrView } from "./xr-view.js";
import { XRTYPE_AR } from "./constants.js";

class XrViews extends EventHandler {
    _manager;
    _index = new Map();
    _list = [];
    _indexTemporary = new Map();
    _supportedColor = platform.browser && !!window.XRCamera && !!window.XRWebGLBinding;
    _availableColor = false;

    constructor(manager) {
        super();

        this._manager = manager;
        this._manager.on('start', this._onSessionStart, this);
        this._manager.on('end', this._onSessionEnd, this);
    }

    _onSessionStart() {
        if (this._manager.type !== XRTYPE_AR)
            return;
        this._availableColor = this._manager.session.enabledFeatures.indexOf('camera-access') !== -1;
    }

    _onSessionEnd() {
        for(const view of this._index.values()) {
            view.destroy();
        }
        this._index.clear();
        this._availableColor = false;
        this._list.length = 0;
    }

    update(frame, xrViews) {
        for(let i = 0; i < xrViews.length; i++) {
            this._indexTemporary.set(xrViews[i].eye, xrViews[i]);
        }

        for(const [ eye, xrView ] of this._indexTemporary) {
            let view = this._index.get(eye);

            if (!view) {
                // add new view
                view = new XrView(this._manager, xrView);
                this._index.set(eye, view);
                this._list.push(view);
                view.update(frame, xrView);
                this.fire('add', view);
            } else {
                // update existing view0
                view.update(frame, xrView);
            }
        }

        // remove views
        for(const [ eye, view ] of this._index) {
            if (this._indexTemporary.has(eye))
                continue;

            view.destroy();
            this._index.delete(eye);
            const ind = this._list.indexOf(view);
            if (ind !== -1) this._list.splice(ind, 1);
            this.fire('remove', view);
        }

        this._indexTemporary.clear();
    }

    get(name) {
        return this._index.get(name) || null;
    }

    get list() {
        return this._list;
    }

    get size() {
        return this._list.length;
    }

    get supportedColor() {
        return this._supportedColor;
    }

    get availableColor() {
        return this._availableColor;
    }
}

export { XrViews };
