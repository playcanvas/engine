pc.extend(pc.scene, function () {
    /**
    * @name pc.scene.GraphManager
    * @class The GraphManager is used to create new instances of GraphNodes for the main graph.
    * It maintains a list of all Nodes created so that they can be easily access by their Sequential ID,
    * or their GUID, if they have one.
    * @author Dave Evans
    */
    var GraphManager = function (loader) {
        this._sidCounter = 1;
        this._index = {}; // Index of nodes by SID
        this._gindex = {}; // Index of entities by GUID
        //this.loader = new pc.scene.JsonLoader(this, loader);
    }
    
    /**
    * @function
    * @name pc.scene.GraphManager#addNode
    * @description Add a GraphNode to the GraphManager
    * @author Dave Evans
    */
    GraphManager.prototype.addNode = function (node) {
        this._index[node.getSequenceId()] = node;
        if(node.getGuid) {
            this._gindex[node.getGuid()] = node;
        }
    };
    
    /**
    * @function
    * @name pc.scene.GraphManager#removeNode
    * @description Removed a GraphNode from the GraphManager
    * @author Dave Evans
    */
    GraphManager.prototype.removeNode = function (node) {
        delete this._index[node.getSequenceId()];
        if(node.getGuid) {
            delete this._gindex[node.getGuid()];
        }
    };
    
    /**
    * @function
    * @name pc.scene.GraphManager#findBySequenceId
    * @description Find a GraphNode from its sequence ID
    * @param {Number} sequenceId The sequenceId of the GraphNode to find
    * @author Dave Evans
    */
    GraphManager.prototype.findBySequenceId = function (sequenceId) {
        return this._index[sid];
    };
    
    /**
    * @function
    * @name pc.scene.GraphManager#findByGuid
    * @description Find a Node by it's GUID. N.B. Only Entity Nodes have a GUID
    * @param {String} guid The GUID of the Node to find
    * @author Dave Evans
    */
    GraphManager.prototype.findByGuid = function (guid) {
        return this._gindex[guid];
    };
    
    /**
    * @function
    * @name pc.scene.GraphManager#create
    * @description Factory method which creates a new Node adds it to the GraphManager. Use this instead of newing Node classes directly.
    * @example
    * var manager = new pc.scene.GraphManager();
    * var node = manager.create(pc.scene.GraphNode);
    * var light = manager.create(pc.scene.LightNode);
    * @author Dave Evans
    */
    GraphManager.prototype.create = function (Type) {
        var node = new Type();
        node.setSequenceId(this._sidCounter++);
        this.addNode(node);
        return node;
    };
        
    return {
        GraphManager: GraphManager   
    };
}());