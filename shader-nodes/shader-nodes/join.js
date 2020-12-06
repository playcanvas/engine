// node
var join = {
    code: "vec2 join(in float x, in float y){return vec2(x,y);}",
    meta: { label: "JOIN" }
};

// ports
join.meta.ports = [];
join.meta.ports[0] = { label: '', id: 0 };
join.meta.ports[1] = { label: 'R', id: 1 };
join.meta.ports[2] = { label: 'G', id: 2 };
join.meta.ports[3] = { label: 'B', id: 3 };
join.meta.ports[4] = { label: 'A', id: 4 };

// generator
join.gen = function ( argTypes ) {
    return this.code;
};

// export { join };
export default join;
