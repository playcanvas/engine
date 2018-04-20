var ScriptWithAttributes = pc.createScript('scriptWithAttributes');

ScriptWithAttributes.attributes.add('attribute1', {type: 'entity'});
ScriptWithAttributes.attributes.add('attribute2', {type: 'number', default: 2});

ScriptWithAttributes.prototype.initialize = function() {
};

ScriptWithAttributes.prototype.postInitialize = function () {
};
