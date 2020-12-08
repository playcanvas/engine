// node
var flexOp = {
    // code: "RET_TYPE opName(in TYPE_0 arg0, in TYPE_1 arg1, ... )\n{\n    return RET_TYPE(arg0,EXPAND_0) opCode RET_TYPE(arg1,EXPAND_1) ... ;\n}",
    meta: { label: "FLEXIBLE OPERATOR" },
    type2Comp: { float: 1, vec2: 2, vec3: 3, vec4: 4 },
    comp2Type: ['', 'float', 'vec2', 'vec3', 'vec4']
};

// ports
flexOp.meta.ports = [];
flexOp.meta.ports[0] = { label: '', id: 0 };
flexOp.meta.ports[1] = { label: 'A', id: 1 };
flexOp.meta.ports[2] = { label: 'B', id: 2 };
flexOp.meta.ports[3] = { label: 'C', id: 3 };
flexOp.meta.ports[4] = { label: 'D', id: 4 };
flexOp.meta.ports[5] = { label: 'E', id: 5 };
flexOp.meta.ports[6] = { label: 'F', id: 6 };

// utility
flexOp.getRetType = function ( argTypes ) {
    var maxComp = 0;
    for (var argIndex = 0; argIndex < argTypes.length; argIndex++) {
        maxComp = Math.max(maxComp, this.type2Comp[argTypes[argIndex]]);
    }
    return this.comp2Type[maxComp];
};

flexOp.getHeadCode = function (retType, opName, argTypes, outputRetComponents ) {
    var code = retType + ' ' + opName + '( ';
    for (var argIndex = 0; argIndex < argTypes.length; argIndex++) {
        code += 'in ' + argTypes[argIndex] + ' arg' + argIndex;

        code += (argIndex === argTypes.length - 1) ? ' )\n' : ', ';
    }
    if (outputRetComponents && this.type2Comp[retType] === 4) {
        code.replace(' )\n', ', out vec3 rgb, out float r, out float g, out float b, out float a )\n');
    }

    return code;
};

// generator
flexOp.gen = function ( argTypes, options ) {
    var opName = options.opName;
    var opCode = options.opCode;

    // determine return type
    var retType = this.getRetType(argTypes);

    // construct head code
    var code = this.getHeadCode(retType, opName, argTypes);

    // precision - alter name to create variant
    if (options && options.precision) {
        code = code.replace(' ' + opName, ' ' + opName + '_' + options.precision);
    }

    // construct body code
    code += '{\n';

    // precision - tmp: useful comment
    code += ((options && options.precision) ? '// precision ' + options.precision + ' float;\n' : '');

    code += '    return ';

    for (var argIndex = 0; argIndex < argTypes.length; argIndex++) {
        // convert all arguments to return type
        code += retType + '(arg' + argIndex;

        // expand if needed - extra components are set to zero - NB scalar values are broadcast to all components
        var argComp = this.type2Comp[argTypes[argIndex]];
        var extend = this.type2Comp[retType] - argComp;
        code += (extend > 0 && argComp !== 1) ? ', ' + this.comp2Type[expand] + '(0))' : ')';

        code += (argIndex === argTypes.length - 1) ? ';\n' : ' ' + opCode + ' ';
    }

    code += '}\n';

 /*   if (options && options.precision)
    {
        var pcode = code.replace('float ')
    }
    else*/
    // {
        return code;
    // }
};

export { flexOp };
export default flexOp;
