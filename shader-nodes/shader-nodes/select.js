import { flexOp } from "./flexOp";
// node
var select = {
    // code: "vec3 select(in float s, in vec3 c0, in vec3 c1, ... )\n{\n    if (s>=0.0 && s<1.0){return c0} if (s>=1.0 && s<2.0){return c1} ... \n}",
    meta: { label: "SELECT" }
};

// ports
select.meta.ports = [];
select.meta.ports[0] = { label: 'S', id: 0 };
select.meta.ports[1] = { label: 'C0', id: 1 };
select.meta.ports[2] = { label: 'C1', id: 2 };
select.meta.ports[1] = { label: 'C2', id: 3 };
select.meta.ports[2] = { label: 'C3', id: 4 };
select.meta.ports[1] = { label: 'C4', id: 5 };
select.meta.ports[2] = { label: 'C5', id: 6 };

// generator
select.gen = function ( argTypes, options ) {
    var retType = flexOp.getRetType(argTypes);

    // construct head code
    var code = flexOp.getHeadCode(retType, 'select', argTypes);

    // precision - alter name to create variant
    if (options && options.precision) {
        code = code.replace(' select', ' select_' + options.precision);
    }

    // construct body code
    code += '{\n';

    // precision - tmp: useful comment
    code += ((options && options.precision) ? '// precision ' + options.precision + ' float;\n' : '');

    for (var argIndex = 1; argIndex < argTypes.length; argIndex++) {

        code += 'if (arg0>=float(' + (argIndex - 1) + ') && arg0<float(' + (argIndex + 0) + ') )\n';
        code += '{\n';
        code += '    return ';
        code += retType + '(arg' + argIndex;
        var argComp = flexOp.type2Comp[argTypes[argIndex]];
        var extend = flexOp.type2Comp[retType] - argComp;
        code += (extend > 0 && argComp !== 1) ? ', ' + flexOp.comp2Type[extend] + '(0))' : ')';
        code += ';\n';
        code += '}\n';
    }

    code += '}\n';

    return code;
};

// export { cross };
export default select;
