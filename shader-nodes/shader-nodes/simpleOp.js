var simpleOp = {
    genOp: function ( retType, opName, retName, label ) {
        var op = {
            // placeholder for meta data
            // placeholder for editor data
            editor: { label: label },
            // generator
            gen: function ( argTypes, options ) {
                var code = retType + " " + opName + "(){\n    return " + retName + ";\n}\n";
                if (options && options.precision) {
                    // precision - alter name to create variant
                    code = code.replace(' ' + opName, ' ' + opName + '_' + options.precision);
                    // precision - tmp: useful comment
                    code = code.replace( '{\n', '{\n// precision ' + options.precision + ' float;\n');
                }
                return code;
            }
        };
        return op;
    }
};

export { simpleOp };
