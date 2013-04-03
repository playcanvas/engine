var editor = editor || {};
pc.extend(editor, function () {
    var LinkInterface = function () {
        this.exposed = {};
        this.added = {};
        this.scripts = {};
        this.systems = [];
    };
    
    LinkInterface.prototype = {
        addComponentType: function () {},
        expose: function () {},
        add: function () {},
        scriptexpose: function () {}
    };
    
    return {
        LinkInterface: LinkInterface,
        link: new LinkInterface()    
    };
}());
