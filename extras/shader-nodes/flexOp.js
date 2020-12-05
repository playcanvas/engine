// node
var flexOp = {
    // code: "RET_TYPE opName(in A_TYPE a, in B_TYPE b, )\n{\n    return RET_TYPE(a,A_SWIZZLE)+RET_TYPE(b,B_SWIZZLE);\n}",
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

// generator
flexOp.gen = function ( argTypes, opName, opCode ) {
    // determine return type
    var maxComp = 0;
    var argIndex;
    for (argIndex = 0; argIndex < argTypes.length; argIndex++) {
        maxComp = Math.max(maxComp, this.type2Comp[argTypes[argIndex]]);
    }
    var retType = this.comp2Type[maxComp];

    // construct code
    // head
    var code = retType + ' ' + opName + '( ';

    for (argIndex = 0; argIndex < argTypes.length; argIndex++) {
        code += 'in ' + argTypes[argIndex] + ' arg' + argIndex;

        code += (argIndex === argTypes.length - 1) ? ' )\n' : ', ';
    }
    // body
    code += '{\n';
    code += 'return ';

    for (argIndex = 0; argIndex < argTypes.length; argIndex++) {
        // convert all arguments to return type
        code += retType + '(arg' + argIndex;

        // expand if needed - extra components are set to zero - NB scalar values are broadcast to all components
        var argComp = this.type2Comp[argTypes[argIndex]];
        var expand = this.type2Comp[retType] - argComp;
        code += (expand > 0 && argComp !== 1) ? ', ' + this.comp2Type[expand] + '(0))' : ')';

        code += (argIndex === argTypes.length - 1) ? ' ;\n' : ' ' + opCode + ' ';
    }

    code += '}\n';

    return code;
};

export { flexOp };
export default flexOp;
