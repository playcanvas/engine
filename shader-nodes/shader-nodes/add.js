import { flexOp } from "./flexOp";

// node
var add = {
    meta: { label: "ADD" }
};

// ports
add.meta.ports = flexOp.meta.ports;

// generator
add.gen = function ( argTypes, options ) {
    var opt = { opName: 'add', opCode: '+' };
    Object.assign(opt, options);
    return flexOp.gen(argTypes, opt );
};

// export { add };
export default add;
