var simpleOp = {};

simpleOp.genOp = function ( retType, opName, retName, metaLabel ) {
    var op = {};

    op.code = retType + " " + opName + "(){\n    return " + retName + ";\n}\n";
    op.meta = { label: metaLabel };
    op.gen = function ( argTypes, options ) {
        var code = this.code;
        if (options && options.precision) {
            // precision - alter name to create variant
            code = code.replace(' ' + opName, ' ' + opName + '_' + options.precision);
            // precision - tmp: useful comment
            code = code.replace( '{\n', '{\n// precision ' + options.precision + ' float;\n');
        }
        return code;
    };

    return op;
};

export { simpleOp };
