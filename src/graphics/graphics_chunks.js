pc.gfx.shaderChunks = {}
pc.gfx.shaderCache = {}

pc.gfx.collectAttribs = function (VScode) {
    var attribs = {}
    var attrs = 0;

    var found = VScode.indexOf("attribute");
    while (found >= 0) {
        var endOfLine = VScode.indexOf(';', found);
        var startOfAttribName = VScode.lastIndexOf(' ', endOfLine);
        var attribName = VScode.substr(startOfAttribName + 1, endOfLine - (startOfAttribName + 1));

        if (attribName == "aPosition") {
            attribs.aPosition = pc.gfx.SEMANTIC_POSITION;
        } else {
            attribs[attribName] = "ATTR" + attrs;
            attrs++;
        }

        found = VScode.indexOf("attribute", found + 1);
    }
    return attribs;
}


pc.gfx.shaderChunks.CreateShader = function(device, vsName, psName) {
    var VScode = shaderChunks[vsName];
    var PScode = pc.gfx.programlib.getSnippet(device, 'fs_precision') + "\n" + shaderChunks[psName];
    attribs = collectAttribs(VScode);

    return new pc.gfx.Shader(device, {
        attributes: attribs,
        vshader: VScode,
        fshader: PScode
    });
}

pc.gfx.shaderChunks.CreateShaderFromCode = function(device, VScode, PScode, uName) {
    var cached = pc.gfx.shaderCache[uName];
    if (cached != undefined) return cached;

    PScode = pc.gfx.programlib.getSnippet(device, 'fs_precision') + "\n" + PScode;
    attribs = pc.gfx.collectAttribs(VScode);
    pc.gfx.shaderCache[uName] = new pc.gfx.Shader(device, {
        attributes: attribs,
        vshader: VScode,
        fshader: PScode
    });
    return pc.gfx.shaderCache[uName];
}
