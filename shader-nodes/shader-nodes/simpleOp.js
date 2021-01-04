var simpleOp = {
    genOp: function ( retType, opName, retName, label ) {
        var op = {
            // placeholder for meta data
            // placeholder for editor data
            editor: { label: label },
            // generator
            gen: function ( argTypes, options ) {
                var precision = (options && options.precision) ? `_${options.precision}` : ''; // alter name to create variant
                var code = `${retType} ${opName}${precision}(){\n    return ${retName};\n}\n`;
                return code;
            }
        };
        return op;
    }
};

export { simpleOp };
