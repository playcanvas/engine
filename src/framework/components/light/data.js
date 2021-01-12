import { _lightProps, _lightPropsDefault } from './component.js';

class LightComponentData {
    constructor() {
        var _props = _lightProps;
        var _propsDefault = _lightPropsDefault;
        var value;
        for (var i = 0; i < _props.length; i++) {
            value = _propsDefault[i];
            if (value && value.clone) {
                this[_props[i]] = value.clone();
            } else {
                this[_props[i]] = value;
            }
        }
    }
}

export { LightComponentData };
