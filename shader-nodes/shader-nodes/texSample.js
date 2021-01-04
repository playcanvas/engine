// node
var texSample = {
    // placeholder for meta data
    // placeholder for editor data
    editor: { label: "TEXTURE SAMPLE" },
    // generator
    gen: function ( argTypes, options ) {
        // header
        var precision = (options && options.precision) ? `_${options.precision}` : ''; // alter name to create variant
        var code = `void texSample${precision}(in sampler2D tex, in vec2 uv, out vec4 rgba, out vec4 srgba, out vec3 rgbm)\n`;

        // body
        code += '{\n';

        code += 'rgba = texture2D(tex, uv);\n';

        code += 'srgba.rgb = gammaCorrectInput(rgba.rgb);\n';
        code += 'srgba.a = rgba.a;\n';

        code += 'rgbm.rgb = decodeRGBM(rgba);\n';

        code += '}\n';

        return code;
    }
};

export { texSample };
