// node
var texSample = {
    // placeholder meta data - structure will be finalized in MVP S3
    meta: {
        ports: [
            { id: 0 },
            { id: 1 }
        ]
    },
    // placeholder editor data - structure will be finalized in MVP S3
    editor: {
        label: "TEXTURE SAMPLE",
        ports: [
            { label: 'TEXTURE' },
            { label: 'UV' }
        ]
    }
};

// generator
texSample.gen = function ( argTypes, options ) {

    // header
    var code = "void texSample(in sampler2D tex, in vec2 uv, out vec4 rgba, out vec4 srgba, out vec3 rgbm)\n";

    // precision - alter name to create variant
    if (options && options.precision) {
        code = code.replace(' texSample', ' texSample_' + options.precision);
    }

    // body
    code += '{\n';

    // precision - tmp: useful comment
    code += ((options && options.precision) ? '// precision ' + options.precision + ' float;\n' : '');

    code += 'rgba = texture2D(tex, uv);\n';

    code += 'srgba.rgb = gammaCorrectInput(rgba.rgb);\n';
    code += 'srgba.a = rgba.a;\n';

    // code += 'lowp vec3 test = rgba.rgb;\n';

    code += 'rgbm.rgb = decodeRGBM(rgba);\n';

    code += '}\n';

    return code;
};

export { texSample };
