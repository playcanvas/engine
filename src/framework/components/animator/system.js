pc.extend(pc, function () {
    var _schema = ['enabled'];

    var AnimatorComponentSystem = function AnimatorComponentSystem(app) {
        this.id = 'animator';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.AnimatorComponent;
        this.DataType = pc.AnimatorComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);

        pc.ComponentSystem.on('update', this._onUpdate, this);
    };
    AnimatorComponentSystem = pc.inherits(AnimatorComponentSystem, pc.ComponentSystem);
    pc.Component._buildAccessors(pc.AnimatorComponent.prototype, _schema);

    pc.extend(AnimatorComponentSystem.prototype, {
        /**
         * Initialize a new component from the data object
         * @param  {pc.AnimatorComponent} The component that needs to be initialized
         * @param  {Object} data         Object containing data to be copied into component
         * @param  {Array} properties    (Deprecated - ignore this) List of properties to initialize
         */
        initializeComponentData: function (component, data, properties) {  
            if(data.enabled !== undefined) component.enabled = data.enabled;  
            AnimatorComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        /**
         * Function called when entity.clone() is used to copy an entity
         * @param  {pc.Entity} entity       original entity that is being copied
         * @param  {pc.Entity} clone        new entity that has just been created
         * @return {pc.AnimatorComponent}    the newly cloned component
         */
        cloneComponent: function (entity, clone) {
            var key;
            this.addComponent(clone, {});
 
            clone.animator.enabled = entity.animator.enabled;
            clone.animator.model = entity.animator.model; 
            clone.animator.clips = {};

            var clipNames = Object.keys(entity.animator.clips);
            for(var i = 0; i < clipNames; i ++) {
                var clip = entity.animator.clips[clipNames[i]];
                if(!clip) continue;

                var clipClone = clip.clone(); 
                clone.animator.clips[clipClone.name] = clipClone;
                if(entity.animator.currentClip === clip)
                    clone.animator.currentClip = clipClone;
            } 
        },

        /**
         * Event handler called just before an animator component is removed from an entity
         * @param  {[type]} entity    the entity the component is going to be removed from
         * @param  {[type]} component the component being removed
         */
        _onRemoveComponent: function (entity, component) {
            component.onBeforeRemove(); 
        },

        /**
         * Called once every frame. Use this to update animator components
         * @param  {[type]} dt time in seconds since last frame
         */
        _onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var component = components[id];  
                    if (component.data.enabled && component.entity.enabled) { 
                        var animator = component.entity.animator;
                        if(animator) animator.onUpdate(dt);
                    }
                }
            }
        },


        /**
         * Other methods that need to operate at a system-wide level, either
         * to set state for the whole application or to operate on all animator components
         */
        otherMethod: function () {

        }

    });

    return {
        AnimatorComponentSystem: AnimatorComponentSystem
    };
}());
