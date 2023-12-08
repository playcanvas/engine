export default class Destroyer {
    // Default values for attributes
    static attributes = {
        methodName: { type: 'string' },
        destroyEntity: { type: 'boolean' },
        destroyScriptComponent: { type: 'boolean' },
        destroyScriptInstance: { type: 'boolean' }
    };

    initialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' initialize destroyer');

        this.on('state', function (state) {
            window.initializeCalls.push(this.entity.getGuid() + ' state ' + state + ' destroyer');
        });
        this.on('disable', function () {
            window.initializeCalls.push(this.entity.getGuid() + ' disable destroyer');
        });
        this.on('enable', function () {
            window.initializeCalls.push(this.entity.getGuid() + ' enable destroyer');
        });

        if (this.methodName === 'initialize') {
            this.destroySomething();
        }
    }

    postInitialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' postInitialize destroyer');

        if (this.methodName === 'postInitialize') {
            this.destroySomething();
        }
    }

    update() {
        window.initializeCalls.push(this.entity.getGuid() + ' update destroyer');

        if (!this.methodName || this.methodName === 'update')  {
            this.destroySomething();
        }
    }

    postUpdate() {
        window.initializeCalls.push(this.entity.getGuid() + ' postUpdate destroyer');

        if (this.methodName === 'postUpdate') {
            this.destroySomething();
        }
    }

    destroy() {
        window.initializeCalls.push(this.entity.getGuid() + ' destroy destroyer');
    }

    destroySomething() {
        if (this.destroyEntity) {
            return this.entity.destroy();
        }

        if (this.destroyScriptComponent) {
            return this.entity.removeComponent('script');
        }

        if (this.destroyScriptInstance) {
            if (this.entity.script.scriptA) {
                return this.entity.script.destroy('scriptA');
            }
        }
    }
}
