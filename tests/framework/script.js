pc.script.create("test_script", function(context) {
    var Script = function (entity) {
        
    };
    
    Script.prototype.sum = function (a, b) {
        return a + b;
    }
    
    Script.prototype.store = function (v) {
        this.v = v;
    }
    
    return Script;
    
});
