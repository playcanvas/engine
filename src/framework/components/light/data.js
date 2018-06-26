Object.assign(pc, function () {
    var LightComponentData = function () {
        var _props = pc._lightProps;
        var _propsDefault = pc._lightPropsDefault;
        var value;
        for (var i = 0; i < _props.length; i++) {
            value = _propsDefault[i];
            if (value && value.clone) {
                this[_props[i]] = value.clone();
            } else {
                this[_props[i]] = value;
            }
        }
    };

    return {
        LightComponentData: LightComponentData
    };
}());
