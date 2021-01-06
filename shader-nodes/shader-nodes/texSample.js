// node
var texSample = {
    // placeholder for meta data
    // placeholder for editor data
    editor: { label: "TEXTURE SAMPLE" },
    // generator
    gen: function ( argTypes, options ) {
        // header
        var precision = (options && options.precision) ? `_${options.precision}` : ''; // alter name to create variant

        return `
        void texSample${precision}(in sampler2D tex, in vec2 uv, out vec4 rgba, out vec4 srgba, out vec3 rgbm)
        {
            rgba = texture2D(tex, uv);
            srgba.rgb = gammaCorrectInput(rgba.rgb);
            srgba.a = rgba.a;
            rgbm.rgb = decodeRGBM(rgba);
        }
        `;
    }
};

export { texSample };
