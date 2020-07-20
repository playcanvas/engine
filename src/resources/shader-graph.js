import { http } from '../net/http.js';
import { ShaderGraph } from '../scene/materials/shader-graph.js';



/**
 * @class
 * @name pc.ShaderGraphNodeHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.ShaderGraphNode} resources.
 * @param {pc.Application} app - The running {@link pc.Application}.
 */
function ShaderGraphHandler(app) {
    this._assets = app.assets;

    this._placeholderNodeFunc = new ShaderGraphNode('float f_val(in float val) { return val; }');

    this.retryRequests = false;
}

Object.assign(ShaderGraphHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // Loading from URL (engine-only)
        http.get(url.load, {
            retry: this.retryRequests
        }, function (err, response) {
            if (!err) {
                if (callback) {
                    response._engine = true;
                    callback(null, response);
                }
            } else {
                if (callback) {
                    callback("Error loading shader graph: " + url.original + " [" + err + "]");
                }
            }
        });
    },

    _onNodeFuncLoad: function (parameterName, node, funcAsset) {
        //bind
        node.func=funcAsset.resource;
        //validate?
        //...
    },

    _onNodeFuncAdd: function (parameterName, node, funcAsset) {
        //request load
        this._assets.load(funcAsset);
    },

    _onNodeFuncRemove: function (parameterName, node, funcAsset) {
        //bind placeholder
        shaderGraph.nodes[i].func = this._placeholderNodeFunc;
    },

    open: function (url, data) {
        //assume data is a graph asset (has a list of nodes and no asset reference in root) 
        shaderGraph = new ShaderGraphNode(data.nodes, data.inputs, data.outputs);

        //deal with asset ids/references in node list
        for (var i;i<shaderGraph.nodes.length;i++)
        {
            if (shaderGraph.nodes[i].func)
            {
                if (!shaderGraph.nodes[i].func instanceof ShaderGraphNode && !shaderGraph.nodes[i].func instanceof Text )
                {
                    //not bound - check if loaded and bind - or if not loaded set placeholder and request asset load
                    var assetReference = new AssetReference('func', shaderGraph.nodes[i], this._assets, {
                        load: this._onNodeFuncLoad,
                        add: this._onNodeFuncAdd,
                        remove: this._onNodeFuncRemove
                    }, this);
                    
                    assetReference.id = shaderGraph.nodes[i].func;

                    // check asset is even in app asset list
                    if (assetReference.asset) 
                    {
                        //check if asset is loaded
                        if (assetReference.asset.resource) 
                        {
                            // func asset is already loaded - bind and validate
                            _onNodeFuncLoad('func',shaderGraph.nodes[i], assetReference.asset);
                        } 
                        else 
                        {
                            //not yet loaded use placeholder func - which is replaced in _onNodeFuncLoad() when loaded
                            _onNodeFuncRemove('func',shaderGraph.nodes[i], assetReference.asset);
                        }

                        this._assets.load(assetReference.asset); // I think this is probably async (and added to a queue) 
                    }
                    else
                    {
                        //this is bad asset id doesn't match any asset in app assets? 
                    }
                }
                else 
                {
                    //func already loaded, bound and validated - this shouldn't be possible?
                }
            }
            else
            {
                //this should never happen - all nodes in a graph list should reference an asset
            }
        }

        return shaderGraph;
    },

    patch: function (asset, assets) {
        // not sure if this is needed?
    },

});

export { ShaderGraphHandler };
