// node
var cross = {
    code: "vec3 cross(in vec3 a, in vec3 b)\n{\n    return cross(a,b);\n}",
    // placeholder meta data - structure will be finalized in MVP S3
    meta: {
        ports: [
            { id: 0 },
            { id: 1 },
            { id: 2 }
        ]
    },
    // placeholder editor data - structure will be finalized in MVP S3
    editor: {
        label: "CROSS PRODUCT",
        ports: [
            { label: '' },
            { label: 'TEXTURE' },
            { label: 'UV' }
        ]
    }
};

// generator
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

export { cross };
