// node
var texSample = {
    code: "void texSample(in sampler2D tex, in vec2 uv, out vec4 rgba, out vec3 rgb, out float r, out float g, out float b, out float a) \n{\n    rgba = texture2D(tex, uv);\n    rgb = rgba.rgb;\n    r = rgba.r;\n    g = rgba.g;\n    b = rgba.b;\n    a = rgba.a;\n}",
    meta: { label: "TEXTURE SAMPLE" }
};

// ports
texSample.meta.ports = [];
texSample.meta.ports[0] = { label: 'TEXTURE', id: 0 };
texSample.meta.ports[1] = { label: 'UV', id: 1 };
texSample.meta.ports[2] = { label: 'RGBA', id: 2 };
texSample.meta.ports[3] = { label: 'RGB', id: 3 };
texSample.meta.ports[4] = { label: 'R', id: 4 };
texSample.meta.ports[5] = { label: 'G', id: 5 };
texSample.meta.ports[6] = { label: 'B', id: 6 };
texSample.meta.ports[7] = { label: 'A', id: 7 };

// generator
texSample.gen = function ( argTypes ) {
    return this.code;
};

//export { texSample };
export default texSample;
