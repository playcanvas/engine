import flexOp from './flexOp.js';

// node
var mul = {
    meta: { label: "MUL" }
};

// ports
mul.meta.ports = flexOp.meta.ports;

// generator
mul.gen = function ( argTypes, options ) {
    var opt = { opName: 'mul', opCode: '*' };
    Object.assign(opt, options);
    return flexOp.gen(argTypes, opt );
};

// export { mul };
export default mul;
