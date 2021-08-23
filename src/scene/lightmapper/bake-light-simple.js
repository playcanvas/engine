import { BakeLight } from './bake-light.js';

class BakeLightSimple extends BakeLight {
    prepareVirtualLight(index, numVirtualLights) {

        const light = this.light;

        // TODO: handle other types than directional

        // TODO: diferent distribution? Perhaps 2d loop in the plane of light direction to get more uniform and predictable pattern
        const directionalSpreadAngle = 30;
        const angle1 = Math.random() * directionalSpreadAngle - directionalSpreadAngle * 0.5;
        const angle2 = Math.random() * directionalSpreadAngle - directionalSpreadAngle * 0.5;

        // set to original rotation and add adjustement
        light._node.setLocalRotation(this.rotation);
        light._node.rotateLocal(angle1, 0, angle2);

        // update transform
        light._node.getWorldTransform();


        // TODO: this does not seem to work well and lightmap gets dark with more virtual lights
        light.intensity = this.intensity / numVirtualLights;
    }
}

export { BakeLightSimple };
