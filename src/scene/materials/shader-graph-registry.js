var ShaderGraphRegistry = {};

ShaderGraphRegistry.registerNode = function (name, node) {
    ShaderGraphRegistry[name] = node;
};

ShaderGraphRegistry.getNode = function (name) {
    return ShaderGraphRegistry[name];
};

export { ShaderGraphRegistry };
