// helper class to wrap node including its meshInstances
class BakeMeshNode {
    constructor(node, meshInstances = null) {
        this.node = node;

        this.component = node.render || node.model;
        meshInstances = meshInstances || this.component.meshInstances;

        // original component properties
        this.store();

        this.meshInstances = meshInstances;

        // world space aabb for all meshInstances
        this.bounds = null;

        // render target with attached color buffer for each render pass
        this.renderTargets = [];
    }

    store() {
        this.castShadows = this.component.castShadows;
    }

    restore() {
        this.component.castShadows = this.castShadows;
    }
}

export { BakeMeshNode };
