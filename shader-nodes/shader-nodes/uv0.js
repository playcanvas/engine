// node
var uv0 = {
    code: "vec2 uv0(){\n    return vUv0;\n}\n",
    meta: { label: "UV0" }
};

// ports

// generator
uv0.gen = function ( argTypes, options ) {
    var code = this.code;

    if (options && options.precision) {
        // precision - alter name to create variant
        code = code.replace(' uv0', ' uv0_' + options.precision);
        // precision - tmp: useful comment
        code = code.replace( '{\n', '{\n// precision ' + options.precision + ' float;\n');
    }

    return code;};

// export { uv0 };
export default uv0;
