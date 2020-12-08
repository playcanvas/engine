// node
var cross = {
    code: "vec3 cross(in vec3 a, in vec3 b)\n{\n    return cross(a,b);\n}",
    meta: { label: "CROSS PRODUCT" }
};

// ports
cross.meta.ports = [];
cross.meta.ports[0] = { label: '', id: 0 };
cross.meta.ports[1] = { label: 'A', id: 1 };
cross.meta.ports[2] = { label: 'B', id: 2 };

// generator - TODO: make flexible
cross.gen = function ( argTypes, options ) {
    var code = this.code;

    if (options && options.precision) {
        // precision - alter name to create variant
        code = code.replace('vec3 cross', 'vec3 cross_' + options.precision);
        // precision - tmp: useful comment
        code = code.replace( '{\n', '{\n// precision ' + options.precision + ' float;\n');
    }

    return code;
};

// export { cross };
export default cross;
