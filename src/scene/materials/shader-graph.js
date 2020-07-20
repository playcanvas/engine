

var ShaderNodeIO = function ShaderNodeIO(node) {
    this.inputName = [];
    this.inputType = [];
    this.outputName = [];
    this.outputType = [];

    if (node.nodes)
    {
        this.genFromNodes(node.nodes); //this can be recursive
    }
    else if (node.shaderFunctionString)
    {
        this.genFromString(node.shaderFunctionString);
    }
    else
    {
        this.genFromParam(node.paramType, node.paramName); //for constants
    }
    
};

ShaderNodeIO.prototype.genFromParam = function (inType, inName) {
    this.outputName.push(inName);
    this.outputType.push(inType);
    
    //this.defineOuputGetter(this.outputName[0], 0);
};

ShaderNodeIO.prototype.genFromString = function (shaderGlsl) {
    var decl_func=shaderGlsl.split("_DECL_FUNC_");
    var functionString = decl_func[1].trim();

    var head = functionString.split(")")[0];
    var rettype_funcname = head.split("(")[0];
    var rettype = rettype_funcname.split(" ")[0];
    var params = head.split("(")[1].split(",");

    this.funcName = rettype_funcname.split(" ")[1];
    // TODO check for function name clashes - maybe replace func name in function string with hash key?

    if (rettype != "void") {
        this.outputName.push('ret');
        this.outputType.push(rettype);
        this.outputTempVarIndex.push(-1);
        this.ret = (this.outputName.length - 1);

        this.defineOuputGetter(this.outputName[0], 0);
    }

    for (var p = 0; p < params.length; p++) {
        var io_type_name = params[p].split(" ");

        if (io_type_name[0] === "") io_type_name.shift();

        if (io_type_name[0] === "out") {
            this.outputName.push(io_type_name[2]);
            this.outputType.push(io_type_name[1]);
    
            //this.defineOuputGetter(this.outputName[this.outputName.length - 1], this.outputName.length - 1);
        }
        if (io_type_name[0] === "in") {
            this.inputName.push(io_type_name[2]);
            this.inputType.push(io_type_name[1]);

            //this.defineInputSetter(this.inputName[this.inputName.length - 1], this.inputName.length - 1);
        } else {
            // unsupported parameter !!! TODO add support for more parameter types?
        }
    }
};

ShaderNodeIO.prototype.genFromNodes = function (nodes) {
    //loop through all nodes look for param and outputs nodes
    for (var i=0;i<nodes.length;i++)
    {
        if (!nodes[i]._io)
        {
            nodes[i]._io=new ShaderNodeIO(nodes[i]);
        } 

        if (nodes[i]._shaderNode.outputName[0].indexOf(`param_`)===0)
        {
            this.inputName.push(nodes[i]._io.outputName[0]);
            this.inputType.push(nodes[i]._io.outputType[0]);
        }
        if (nodes[i]._io.inputName[0].indexOf(`outpt_`)===0)
        {
            this.outputName.push(nodes[i]._io.inputName[0]);
            this.outputType.push(nodes[i]._io.inputType[0]);
        }
    }
};

var ShaderConnection = function ShaderConnection(type, i0, i1, i2, i3) {
    //TODO: validate types and names?
    this.type=type;

    if (type==='n2n')
    {
        this.outNodeIndex=i0;
        this.outOuputIndex=i1;
    
        this.inNodeIndex=i2;
        this.inInputIndex=i3;
    }
    else if (type==='i2n')
    {
        this.iocName=i0;
    
        this.inNodeIndex=i1;
        this.inInputIndex=i2;
    }
    else if (type==='n2i')
    {
        this.outNodeIndex=i0;
        this.outOuputIndex=i1;

        this.iocName=i2;
    }   
};

var ShaderIOC = function ShaderIOC(type, name, value) {
    this.type=type;
    this.name=name;
    this.value=value;
};

var id = 0;
/**
 * @class
 * @name ShaderGraph
 * @classdesc WIP ShaderGraph base class
 * @description WIP Create a new ShaderGraph instance.
 */
var ShaderGraph = function ShaderGraph(funcGlsl, declGlsl) {
    this.name = "shadergraph";
    this.id = id++;

    this.iocs = {}; //inputs outputs or constants

    if (funcGlsl)
    {
        this.funcGlsl=funcGlsl;
        this.declGlsl=declGlsl;
        this._genIOCs();
    }
    else
    {
        this.subGraphs = [];
        this.connections = []; 
    }
};

ShaderGraph.prototype._addIOC= function (type, name, value) {
    if (!this.iocs[name])
    {
        this.iocs[name]=new ShaderIOC(type, name, value);
    }

    return this.iocs[name];
};

ShaderGraph.prototype.addInput = function (type, name, value) {
    return this._addIOC(type, 'IN_'+name, value);
};

ShaderGraph.prototype.addOutput = function (type, name, value) {
    return this._addIOC(type, 'OUT_'+name, value);
};

ShaderGraph.prototype.addConstant = function (type, value) {
    return this._addIOC(type, 'CONST_'+type+'_'+this.iocs.length, value); //create a unique name
};

ShaderGraph.prototype._genIOCs= function () {
    var functionString = this.funcGlsl.trim();

    var head = functionString.split(")")[0];
    var rettype_funcname = head.split("(")[0];
    var rettype = rettype_funcname.split(" ")[0];
    var params = head.split("(")[1].split(",");

    this.funcName = rettype_funcname.split(" ")[1];
    // TODO check for function name clashes - maybe replace func name in function string with hash key?

    if (rettype != "void") {
        this.addOutput(rettype,'ret');
        //this.defineOuputGetter(this.outputName[0], 0);
    }

    for (var p = 0; p < params.length; p++) {
        var io_type_name = params[p].split(" ");

        if (io_type_name[0] === "") io_type_name.shift();

        if (io_type_name[0] === "out") {
            this.addOutput(io_type_name[1],io_type_name[2]);
            //this.defineOuputGetter(this.outputName[this.outputName.length - 1], this.outputName.length - 1);
        }
        if (io_type_name[0] === "in") {
            this.addInput(io_type_name[1],io_type_name[2]);    
            //this.defineInputSetter(this.inputName[this.inputName.length - 1], this.inputName.length - 1);
        } else {
            // unsupported parameter !!! TODO add support for more parameter types?
        }
    }
};

ShaderGraph.prototype.addSubGraph = function (graph) {
    this.subGraphs.push(graph);

    return graph;
};

ShaderGraph.prototype.connectNodeToNode = function (outNodeIndex, outIndex, inNodeIndex, inIndex) {
    var connection = new ShaderConnection("n2n", outNodeIndex, outIndex, inNodeIndex, inIndex);

    this.connections.push(connection);
};

ShaderGraph.prototype.connectIocToNode = function (iocName, inNodeIndex, inIndex) {
    var connection = new ShaderConnection("i2n",iocName, inNodeIndex, inIndex);

    this.connections.push(connection);
};

ShaderGraph.prototype.connectNodeToIoc = function (outNodeIndex, outIndex, iocName) {
    var connection = new ShaderConnection("i2n", outNodeIndex, outIndex, iocName);

    this.connections.push(connection);
};

ShaderGraph.prototype._cloneInternal = function (clone) {
    clone.name = this.name;

    for (var i=0;i<this.nodes.length;i++)
    {
        clone.addNode(this.nodes[i]);
    }

    for (var i=0;i<this.connections.length;i++)
    {
        clone.;
    }
};

ShaderGraph.prototype.clone = function () {
    var clone = new ShaderGraph();
    this._cloneInternal(clone);
    return clone;
};

ShaderGraph.prototype.generateSgCall = function (sg, inNames, outNames)
{
    var callString='';

    if (outNames[0].startsWith('OUT_ret'))
    {
        callString+=outNames[0]+' = ';
    }

    callString+=sg.name'_'+sg.id+'( ';

    for (var name in inNames) 
    {
        callString+=name+', ';
    };

    for (var name in outNames) 
    {
        if (!outNames[0].startsWith('OUT_ret'))
        {
            callString+=name+', ';
        }
    };

    if (callString.endsWith(', ')) callString=callString.slice(0,-2);
            
    callString+=' );\n';

    return callString;
};

ShaderGraph.prototype.generateGlsl = function () {
{
    //assign index for each output from each node
    if (!this.funcGlsl && this.subGraphs)
    {
        //function head
        this.funcGlsl='void '+this.name+'_'+this.id+'( ';

        for (var ioc in this.iocs) 
        {
            if (ioc.name.startsWith('IN_'))
            {
                iocInputMap[ioc]

                this.funcGlsl+='in '+ioc.type+' '+ioc.name+', ';
            }
        };

        for (var ioc in this.iocs) 
        {
            if (ioc.name.startsWith('OUT_'))
            {
                this.funcGlsl+='out '+ioc.type+' '+ioc.name+', ';
            }
        }

        if (this.funcGlsl.endsWith(', ')) this.funcGlsl=this.funcGlsl.slice(0,-2);
            
        this.funcGlsl+=' ) {\n';

        // constants
        for (var ioc in this.iocs) 
        {
            if (ioc.name.startsWith('CONST_'))
            {
                this.funcGlsl+=ioc.type+' '+ioc.name+' = '+ioc.value+';\n';
            }
        }

        //temporary structures - with temp scope only in parsing function
        var tmpVarCounter = 0;
        var outsgTmpVarMap = {};
        var insgTmpVarMap = {};
        var outIocTmpVarMap = {};
        
        var outsgConnectedsgMap = {};
        var insgConnectedsgMap = {};

        //var tmpVarFlag=[];

        var sgFlag=[];
        var sgList=[];

        //create temp vars and graph traversal data
        for (var i=0; i<this.connections.length; i++) 
        {
            var con=this.connections[i];

            if (con.type=='n2n')
            {
                var outsgIndex=con.outNodeIndex;
                
                if (!outsgTmpVarMap[outsgIndex]) outsgTmpVarMap[outsgIndex]=[];

                if (!outsgTmpVarMap[outsgIndex][con.outOuputIndex])
                {
                    this.funcGlsl+=ioc.type+' '+ioc.name+'_'+tmpVarCounter+' = '+ioc.value+';\n';
                    outsgTmpVarMap[outsgIndex][con.outOuputIndex]=ioc.name+'_'+tmpVarCounter;
                    //tmpVarFlag[tmpVarCounter]=0;
                    tmpVarCounter++;
                }
                
                if (!outsgConnectedsgMap[outsgIndex]) outsgConnectedsgMap[outsgIndex]=[];
                outsgConnectedsgMap[outsgIndex].push(con.inNodeIndex);

                var insgIndex=con.inNodeIndex;
                if (!insgTmpVarMap[insgIndex]) insgTmpVarMap[insgIndex]=[];
                
                insgTmpVarMap[insgIndex][con.inInputIndex]=outsgTmpVarMap[outsgIndex][con.outOuputIndex];

                if (!insgConnectedsgMap[insgIndex]) insgConnectedsgMap[insgIndex]=[];
                insgConnectedsgMap[insgIndex][con.inInputIndex]=con.outNodeIndex;
            }
            else if (con.type=='i2n')
            {
                var iocName=con.iocName;
                
                var insgIndex=con.inNodeIndex;
                if (!insgTmpVarMap[insgIndex]) insgTmpVarMap[insgIndex]=[];
                insgTmpVarMap[insgIndex][con.inInputIndex]=iocName;
                
                sgList.push(insgIndex);
                sgFlag[insgIndex]=1; //1 means on the list
            }       
            else if (con.type=='n2o')
            {
                var outsgIndex=con.outNodeIndex;
                
                if (!outsgTmpVarMap[outsgIndex]) outsgTmpVarMap[outsgIndex]=[];

                if (!outsgTmpVarMap[outsgIndex][con.outOuputIndex])
                {
                    this.funcGlsl+=ioc.type+' '+ioc.name+'_'+tmpVarCounter+' = '+ioc.value+';\n';
                    outsgTmpVarMap[outsgIndex][con.outOuputIndex]=ioc.name+'_'+tmpVarCounter;
                    //tmpVarFlag[tmpVarCounter]=0;
                    tmpVarCounter++;
                }
                
                var iocName=con.iocName;
                outIocTmpVarMap[iocName]=outsgTmpVarMap[outsgIndex][con.outOuputIndex];
            }    
        }

        // sub graph function calls     
        for (var i=0; i<sgList.length; i++) 
        {
            var sgIndex=sgList[i];

            this.funcGlsl+=this.generateSubGraphCall(sgIndex, insgTmpVarMap[sgIndex], outsgTmpVarMap[sgIndex]);

            var splicedcount=0;
            //run through all nodes that connect to this node's outputs and splice in if all dependent nodes are before it on the list
            for (var n=0; n<outsgConnectedsgMap[sgIndex].length; n++) 
            {
                var consgIndex=outsgConnectedsgMap[sgIndex][n];
                if (sgFlag[consgIndex]===0)
                {
                    var depflag=1;
                    for (var j=0; j<insgConnectedsgMap[consgIndex].length; j++)
                    {
                        var depsgIndex=insgConnectedsgMap[consgIndex][j]
                        if (!(sgFlag[depsgIndex]>0 && sgFlag[depsgIndex]<=(i+splicedcount)))
                        {
                            depflag=0;
                        }
                    }
                    if (depflag===1)
                    {
                        //sgList.push(consgIndex);
                        sgList.splice(i+splicedcount,0,consgIndex);
                        sgFlag[consgIndex]=i+splicedcount+1;
                        splicedcount++;
                    }
                }
            }
        }

        //output assignment
        for (var ioc in this.iocs) 
        {
            if (ioc.name.startsWith('OUT_'))
            {
                this.funcGlsl+=ioc.name+' = '+outIocTmpVarMap[ioc.name]+';\n';
            }
        }

        this.funcGlsl+='}\n';
    }
};


ShaderGraph.prototype.generateShader = function (graphParamList, graphFuncList, graphTmpVarList, graphNodeStringList) {
    var isRoot = false;
    var i;

    if (!graphParamList && !graphFuncList && !graphTmpVarList && !graphNodeStringList) {
        isRoot = true;
        graphParamList = [];
        graphFuncList = [];
        graphTmpVarList = [];
        graphNodeStringList = [];
    }

    if (this.param) {
        graphParamList.push(this.param);

        var nodeParamString = '';
        // if already set, skip
        if (this.outputTempVarIndex[0] == -1) {
            this.outputTempVarIndex[0] = graphTmpVarList.length;
            graphTmpVarList.push([this.outputType[0], this.outputName[0]]);

            // nodeParamString += this.outputType[0]+' '+this.outputName[0]+'_'+this.outputTempVarIndex[0]+' = '+this.outputName[0]+';\n';
            nodeParamString += '#define ' + this.outputName[0] + '_' + this.outputTempVarIndex[0] + ' ' + this.outputName[0] + '\n';
        }

        graphNodeStringList.push(nodeParamString);
    }

    if (this.functionString) {
        var funcString = '';

        if ( (this.funcName[this.funcName.length - 2] === 'P') && (this.funcName[this.funcName.length - 1] === 'S') ) {
            funcString += '#ifdef SG_PS\n';
        } else if ( (this.funcName[this.funcName.length - 2] === 'V') && (this.funcName[this.funcName.length - 1] === 'S') ) {
            funcString += '#ifdef SG_VS\n';
        }

        funcString += this.functionString + '\n';

        if ( (this.funcName[this.funcName.length - 2] === 'P') && (this.funcName[this.funcName.length - 1] === 'S') ) {
            funcString += '#endif //SG_PS\n';
        } else if ( (this.funcName[this.funcName.length - 2] === 'V') && (this.funcName[this.funcName.length - 1] === 'S') ) {
            funcString += '#endif //SG_VS\n';
        }

        graphFuncList.push(funcString); // TODO (probably before it can compile) remove duplicates

        // get the graphs index for all inputs
        var inputTempVarIndex = [];
        for (i = 0; i < this.inputNode.length; i++) {
            if (this.inputNode[i]) {
                if (this.inputNode[i].outputTempVarIndex[this.inputOutputIndex[i]] == -1) {
                    this.inputNode[i].generateShaderGraph(graphParamList, graphFuncList, graphTmpVarList, graphNodeStringList);
                }
                inputTempVarIndex[i] = this.inputNode[i].outputTempVarIndex[this.inputOutputIndex[i]];
            }
        }
        var nodeString = '';
        // construct the func call string
        if (isRoot) {
            var skip_colalpha = false;
            for (i = 0; i < this.inputNode.length; i++) {
                if (this.inputNode[i]) {
                    switch (this.inputName[i]) {
                        case 'rgba':
                            nodeString += '#ifdef SG_PS\n';
                            nodeString += '    gl_FragColor = ' + graphTmpVarList[inputTempVarIndex[i]][1] + '_' + inputTempVarIndex[i] + ';\n';
                            nodeString += '#endif //SG_PS\n';
                            skip_colalpha = true;
                            break;
                        case 'color':
                            if (skip_colalpha === false) {
                                nodeString += '#ifdef SG_PS\n';
                                nodeString += '    gl_FragColor.rgb = ' + graphTmpVarList[inputTempVarIndex[i]][1] + '_' + inputTempVarIndex[i] + ';\n';
                                nodeString += '#endif //SG_PS\n';
                            }
                            break;
                        case 'alpha':
                            if (skip_colalpha === false) {
                                nodeString += '#ifdef SG_PS\n';
                                nodeString += '    gl_FragColor.a = ' + graphTmpVarList[inputTempVarIndex[i]][1] + '_' + inputTempVarIndex[i] + ';\n';
                                nodeString += '#endif //SG_PS\n';
                            }
                            break;
                        case 'vertexOffset':
                            nodeString += '#ifdef SG_VS\n';
                            nodeString += '    vec3 shaderGraphVertexOffset = ' + graphTmpVarList[inputTempVarIndex[i]][1] + '_' + inputTempVarIndex[i] + ';\n';
                            nodeString += '#endif //SG_VS\n';
                            break;
                    }
                }
            }
        } else {
            if ( (this.funcName[this.funcName.length - 2] === 'P') && (this.funcName[this.funcName.length - 1] === 'S') ) {
                nodeString += '#ifdef SG_PS\n';
            } else if ( (this.funcName[this.funcName.length - 2] === 'V') && (this.funcName[this.funcName.length - 1] === 'S') ) {
                nodeString += '#ifdef SG_VS\n';
            }

            // assign graph index value to each output (if not already assigned)
            for (i = 0; i < this.outputTempVarIndex.length; i++) {
                // if already set, skip
                if (this.outputTempVarIndex[i] == -1) {
                    this.outputTempVarIndex[i] = graphTmpVarList.length;
                    graphTmpVarList.push([this.outputType[i], this.outputName[i]]);

                    nodeString += this.outputType[i] + ' ' + this.outputName[i] + '_' + this.outputTempVarIndex[i] + ';\n';
                }
            }

            var skipRet = false;
            // TODO ensure there isn't a name clash!!!
            if (this.outputName[0] === 'ret') {
                nodeString += graphTmpVarList[this.outputTempVarIndex[0]][1] + '_' + this.outputTempVarIndex[0] + ' = ';
                skipRet = true;
            }

            nodeString += this.funcName + '(';
            for (i = 0; i < this.inputNode.length; i++) {
                nodeString += graphTmpVarList[inputTempVarIndex[i]][1] + '_' + inputTempVarIndex[i];
                if (this.outputTempVarIndex.length > ((skipRet) ? 1 : 0) || i < (this.inputNode.length - 1)) nodeString += ', ';
            }
            for (i = ((skipRet) ? 1 : 0); i < this.outputTempVarIndex.length; i++) {
                nodeString += graphTmpVarList[this.outputTempVarIndex[i]][1] + '_' + this.outputTempVarIndex[i];
                if (i < (this.outputTempVarIndex.length - 1)) nodeString += ', ';
            }
            nodeString += ');\n';

            if ( (this.funcName[this.funcName.length - 2] === 'P') && (this.funcName[this.funcName.length - 1] === 'S') ) {
                nodeString += '#endif //SG_PS\n';
            } else if ( (this.funcName[this.funcName.length - 2] === 'V') && (this.funcName[this.funcName.length - 1] === 'S') ) {
                nodeString += '#endif //SG_VS\n';
            }
        }
        graphNodeStringList.push(nodeString);
    }

    if (isRoot) {
        this.shaderGraphFuncString = '';

        for (i = 0; i < graphFuncList.length; i++) {
            this.shaderGraphFuncString += graphFuncList[i] + '\n';
        }

        this.shaderGraphNodeString = '';
        for (i = 0; i < graphNodeStringList.length; i++) {
            this.shaderGraphNodeString += graphNodeStringList[i] + '\n';
        }

        this.params = graphParamList;
    }
};

var shadergraph = {};

shadergraph.textureSample2D = function (texture, uv) {
    var texSampleNode = new ShaderGraphNode('void texSample(in sampler2D tex, in vec2 uv, out vec4 rgba, out vec3 color, out float alpha) {\n vec4 samp=texture2D(tex, uv);\n rgba=samp;\n color=samp.rgb;\n alpha=samp.a;\n}');
    texSampleNode.tex = new ShaderGraphNode('sampler2D', 'tex', texture);
    texSampleNode.uv = uv;
    return texSampleNode;
};

Object.defineProperty(shadergraph, 'uv0', {
    get: function () {
        return new ShaderGraphNode('vec2 uv0() { return vUv0; }');
    }
});

shadergraph.customNode = function (f,d) {
    var customNode = new ShaderGraphNode(f,d);
    return customNode;
};

Object.defineProperty(shadergraph, 'worldPosPS', {
    get: function () {
        return new ShaderGraphNode('vec3 wpPS() { return vPosition; }');
    }
});

Object.defineProperty(shadergraph, 'worldNormPS', {
    get: function () {
        return new ShaderGraphNode('vec3 wnPS() { return vNormal; }');
    }
});

Object.defineProperty(shadergraph, 'worldPosVS', {
    get: function () {
        return new ShaderGraphNode('vec3 wpVS() { return getWorldPositionNM(); }');
    }
});

Object.defineProperty(shadergraph, 'worldNormVS', {
    get: function () {
        return new ShaderGraphNode('vec3 wnVS() { return getWorldNormalNM(); }');
    }
});

shadergraph.param = function (type, name, value) {
    var paramNode = new ShaderGraphNode(type, name, value);
    return paramNode;
};

shadergraph.root = function (color, alpha, vertOff) {
    var rootNode = new ShaderGraphNode('void root(in vec4 rgba, in vec3 color, in float alpha, in vec3 vertexOffset){}');
    rootNode.color = color;
    rootNode.alpha = alpha;
    rootNode.vertexOffset = vertOff;
    return rootNode;
};

export { ShaderGraph };
