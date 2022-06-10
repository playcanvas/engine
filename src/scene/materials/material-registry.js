import { Shader } from '../../graphics/shader.js';

class MaterialRegistry {
    constructor() {
        this.materials = new Set();
        Shader.debugEvents.on('compileError', shader => this.reportEffectedMaterials(shader));
        Shader.debugEvents.on('linkError', shader => this.reportEffectedMaterials(shader));
    }

    add(material) {
        this.materials.add(material);
    }

    remove(material) {
        this.materials.delete(material);
    }

    reportEffectedMaterials(shader) {
        // search for all materials making use of this shader
        const materials = new Set();
        this.materials.forEach((material) => {
            // check the shader
            if (material.shader === shader) {
                materials.add(material);
            }

            // check material variants
            Object.keys(material.variant || {}).forEach((variantIndex) => {
                const variant = material.variant[variantIndex];
                if (variant === shader) {
                    materials.add(material);
                }
            });

            // check mesh instance variants
            material.meshInstances.forEach((meshInstance) => {
                meshInstance._shader.forEach((variant) => {
                    if (variant === shader) {
                        materials.add(material);
                    }
                });
            });
        });

        if (materials.size > 0) {
            console.error(`Effected materials: `, Array.from(materials));
        }
    }
}

const materialRegistry = new MaterialRegistry();

export {
    materialRegistry
};
