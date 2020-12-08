// node
var join = {
    code: "vec2 join(in float x, in float y){\n    return vec2(x,y);\n}\n",
    meta: { label: "JOIN" }
};

// ports
join.meta.ports = [];
join.meta.ports[0] = { label: '', id: 0 };
join.meta.ports[1] = { label: 'R', id: 1 };
join.meta.ports[2] = { label: 'G', id: 2 };
join.meta.ports[3] = { label: 'B', id: 3 };
join.meta.ports[4] = { label: 'A', id: 4 };

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

// export { join };
export default join;
