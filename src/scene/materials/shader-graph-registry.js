var shadergraphRegistry = {};

shadergraphRegistry.registerNode = function (name, node)
{
    shadergraphRegistry[name] = node;
};

shadergraphRegistry.getNode = function (name)
{
    return shadergraphRegistry[name];
};

export { shadergraphRegistry };
