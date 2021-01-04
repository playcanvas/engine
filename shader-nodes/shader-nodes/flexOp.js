// utility
export var type2Comp = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
export var comp2Type = ['', 'float', 'vec2', 'vec3', 'vec4'];

var flexOp = {
    getRetType: function ( argTypes ) {
        var maxComp = 0;
        for (var argIndex = 0; argIndex < argTypes.length; argIndex++) {
            maxComp = Math.max(maxComp, type2Comp[argTypes[argIndex]]);
        }
        return comp2Type[maxComp];
    },
    getHeadCode: function (retType, opName, argTypes, precision) {
        precision = precision ? `_${precision}` : '';
        var code = `${retType} ${opName}${precision}( `; // alter name to create variant
        for (var argIndex = 0; argIndex < argTypes.length; argIndex++) {
            code += `in ${argTypes[argIndex]} arg${argIndex}`;

            code += (argIndex === argTypes.length - 1) ? ' )\n' : ', ';
        }
        return code;
    },
    genOp: function (opName, opCode, label ) {
        var op = {
            // placeholder for meta data
            // placeholder for editor data
            editor: { label: label },
            // generator
            gen: function ( argTypes, options ) {
                return flexOp.gen(argTypes, options, opName, opCode );
            }
        };
        return op;
    },
    gen: function ( argTypes, options, opName, opCode) {
        // determine return type
        var retType = this.getRetType(argTypes);

        // construct head code
        var code = this.getHeadCode(retType, opName, argTypes, options ? options.precision : '');

        // construct body code
        code += '{\n';

        code += '    return ';

        for (var argIndex = 0; argIndex < argTypes.length; argIndex++) {
            // convert all arguments to return type
            code += `${retType}(arg${argIndex}`;

            // expand if needed - extra components are set to zero - NB scalar values are broadcast to all components
            var argComp = type2Comp[argTypes[argIndex]];
            var extend = type2Comp[retType] - argComp;
            code += (extend > 0 && argComp !== 1) ? `, ${comp2Type[expand]}(0))` : ')';

            code += (argIndex === argTypes.length - 1) ? ';\n' : ` ${opCode} `;
        }

        code += '}\n';

        return code;
    }
};

export { flexOp };
