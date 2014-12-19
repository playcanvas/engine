pc.extend(pc, (function () {
    'use strict';

    var shaderChunks = {}
    var shaderCache = {}

    shaderChunks.collectAttribs = function (vsCode) {
        var attribs = {}
        var attrs = 0;

        var found = vsCode.indexOf("attribute");
        while (found >= 0) {
            var endOfLine = vsCode.indexOf(';', found);
            var startOfAttribName = vsCode.lastIndexOf(' ', endOfLine);
            var attribName = vsCode.substr(startOfAttribName + 1, endOfLine - (startOfAttribName + 1));

            if (attribName == "aPosition") {
                attribs.aPosition = pc.SEMANTIC_POSITION;
            } else {
                attribs[attribName] = "ATTR" + attrs;
                attrs++;
            }

            found = vsCode.indexOf("attribute", found + 1);
        }
        return attribs;
    }


    shaderChunks.createShader = function(device, vsName, psName) {
        var vsCode = shaderChunks[vsName];
        var psCode = pc.programlib.getSnippet(device, 'fs_precision') + "\n" + shaderChunks[psName];
        attribs = this.collectAttribs(vsCode);

        return new pc.Shader(device, {
            attributes: attribs,
            vshader: vsCode,
            fshader: psCode
        });
    }

    shaderChunks.createShaderFromCode = function(device, vsCode, psCode, uName) {
        var cached = shaderCache[uName];
        if (cached != undefined) return cached;

        psCode = pc.programlib.getSnippet(device, 'fs_precision') + "\n" + psCode;
        attribs = this.collectAttribs(vsCode);
        shaderCache[uName] = new pc.Shader(device, {
            attributes: attribs,
            vshader: vsCode,
            fshader: psCode
        });
        return shaderCache[uName];
    }

    return {
        shaderChunks: shaderChunks
    };
}()));
