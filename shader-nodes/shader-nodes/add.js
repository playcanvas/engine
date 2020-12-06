import { flexOp } from "./flexOp";

// node
var add = {
    meta: { label: "ADD" }
};

// ports
add.meta.ports = flexOp.meta.ports;

// generator
add.gen = function ( argTypes ) {
    return flexOp.gen(argTypes, 'add', '+');
};

// export { add };
export default add;
