// node
var texSample = {
    // code: "void texSample(in sampler2D tex, in vec2 uv, out vec4 rgba, out vec4 srgba, out vec3 rgbm)\n",
    meta: { label: "TEXTURE SAMPLE" }
};

// ports
texSample.meta.ports = [];
texSample.meta.ports[0] = { label: 'TEXTURE', id: 0 };
texSample.meta.ports[1] = { label: 'UV', id: 1 };

// generator
texSample.gen = function ( argTypes ) {
    // header
    var code = "void texSample(in sampler2D tex, in vec2 uv, out vec4 rgba, out vec4 srgba, out vec3 rgbm)\n";

    // body
    code += '{\n';
    code += 'rgba = texture2D(tex, uv);\n';

    code += 'srgba.rgb = gammaCorrectInput(rgba.rgb);\n';
    code += 'srgba.a = rgba.a;\n';

    code += 'rgbm.rgb = decodeRGBM(rgba);\n';

    code += '}\n';

    return code;
};

// export { texSample };
export default texSample;
