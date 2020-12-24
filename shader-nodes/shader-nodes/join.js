// node
var join = {
    code: "vec2 join(in float x, in float y){\n    return vec2(x,y);\n}\n",
    // placeholder meta data - structure will be finalized in MVP S3
    meta: {
        ports: [
            { id: 0 },
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 }
        ]
    },
    // placeholder editor data - structure will be finalized in MVP S3
    editor: {
        label: "JOIN",
        ports: [
            { label: '' },
            { label: 'R' },
            { label: 'G' },
            { label: 'B' },
            { label: 'A' }
        ]
    }
};

// generator - TODO: make flexible
join.gen = function ( argTypes, options ) {
    var code = this.code;

    if (options && options.precision) {
        // precision - alter name to create variant
        code = code.replace(' join', ' join_' + options.precision);
        // precision - tmp: useful comment
        code = code.replace( '{\n', '{\n// precision ' + options.precision + ' float;\n');
    }

    return code;
};

export { join };
