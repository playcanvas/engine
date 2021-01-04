import { flexOp, type2Comp, comp2Type } from "./flexOp";

// node
var select = {
    // placeholder for meta data
    // placeholder for editor data
    editor: { label: "SWITCH" },
    // generator
    gen: function ( argTypes, options ) {
        var retType = flexOp.getRetType(argTypes);

        // construct head code
        var code = flexOp.getHeadCode(retType, 'select', argTypes, options ? options.precision : '');

        // construct body code
        code += '{\n';

        for (var argIndex = 1; argIndex < argTypes.length; argIndex++) {
            code += `if (arg0>=float(${argIndex - 1}) && arg0<float(${argIndex + 0}) )\n`;
            code += '{\n';
            code += '    return ';
            code += `${retType}(arg${argIndex}`;
            var argComp = type2Comp[argTypes[argIndex]];
            var extend = type2Comp[retType] - argComp;
            code += (extend > 0 && argComp !== 1) ? `, ${comp2Type[extend]}(0))` : ')';
            code += ';\n';
            code += '}\n';
        }

        code += '}\n';

        return code;
    }
};

export { select };
