var shadergraph_nodeRegistry = {};

shadergraph_nodeRegistry.registerNode = function (name, node)
{
    shadergraph_nodeRegistry[name] = node;
};

shadergraph_nodeRegistry.getNode = function (name)
{
    return shadergraph_nodeRegistry[name];
};

export { shadergraph_nodeRegistry };
