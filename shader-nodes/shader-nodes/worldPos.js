var worldPos = {
    code: "vec3 worldPos(){\n    return vPositionW;\n}\n",
    meta: { label: "WORLD POSITION" },
    gen: function ( argTypes, options ) {
        var code = this.code;
        if (options && options.precision) {
            // precision - alter name to create variant
            code = code.replace(' worldPos', ' worldPos_' + options.precision);
            // precision - tmp: useful comment
            code = code.replace( '{\n', '{\n// precision ' + options.precision + ' float;\n');
        }
        return code;
    }
};

export { worldPos };
