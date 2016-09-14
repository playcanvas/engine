pc.extend(pc, (function () {
    'use strict';

    var shaderChunks = {};

    var attrib2Semantic = {};
    attrib2Semantic["vertex_position"] = pc.SEMANTIC_POSITION;
    attrib2Semantic["vertex_normal"] = pc.SEMANTIC_NORMAL;
    attrib2Semantic["vertex_tangent"] = pc.SEMANTIC_TANGENT;
    attrib2Semantic["vertex_texCoord0"] = pc.SEMANTIC_TEXCOORD0;
    attrib2Semantic["vertex_texCoord1"] = pc.SEMANTIC_TEXCOORD1;
    attrib2Semantic["vertex_color"] = pc.SEMANTIC_COLOR;

    shaderChunks.collectAttribs = function (vsCode) {
        var attribs = {};
        var attrs = 0;

        var found = vsCode.indexOf("attribute");
        while (found >= 0) {
            var endOfLine = vsCode.indexOf(';', found);
            var startOfAttribName = vsCode.lastIndexOf(' ', endOfLine);
            var attribName = vsCode.substr(startOfAttribName + 1, endOfLine - (startOfAttribName + 1));

            var semantic = attrib2Semantic[attribName];
            if (semantic!==undefined) {
                attribs[attribName] = semantic;
            } else {
                attribs[attribName] = "ATTR" + attrs;
                attrs++;
            }

            found = vsCode.indexOf("attribute", found + 1);
        }
        return attribs;
    };


    shaderChunks.createShader = function(device, vsName, psName) {
        var vsCode = shaderChunks[vsName];
        var psCode = pc.programlib.precisionCode(device) + "\n" + shaderChunks[psName];
        var attribs = this.collectAttribs(vsCode);

        return new pc.Shader(device, {
            attributes: attribs,
            vshader: vsCode,
            fshader: psCode
        });
    };

    shaderChunks.createShaderFromCode = function(device, vsCode, psCode, uName) {
        var shaderCache = device.programLib._cache;
        var cached = shaderCache[uName];
        if (cached !== undefined) return cached;

        psCode = pc.programlib.precisionCode(device) + "\n" + psCode;
        var attribs = this.collectAttribs(vsCode);
        shaderCache[uName] = new pc.Shader(device, {
            attributes: attribs,
            vshader: vsCode,
            fshader: psCode
        });
        return shaderCache[uName];
    };

    return {
        shaderChunks: shaderChunks
    };
}()));
