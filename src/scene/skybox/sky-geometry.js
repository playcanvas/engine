import { Debug } from "../../core/debug.js";
import { SKYTYPE_BOX, SKYTYPE_DOME, SKYTYPE_INFINITE } from "../constants.js";
import { Mesh } from "../mesh.js";
import { BoxGeometry } from "../geometry/box-geometry.js";
import { DomeGeometry } from "../geometry/dome-geometry.js";

class SkyGeometry {
    static create(device, type) {
        switch (type) {
            case SKYTYPE_BOX: return SkyGeometry.box(device);
            case SKYTYPE_DOME: return SkyGeometry.dome(device);
        }
        Debug.assert(type === SKYTYPE_INFINITE, `Unsupported sky geometry type ${type}`);
        return SkyGeometry.infinite(device);
    }

    static infinite(device) {
        return Mesh.fromGeometry(device, new BoxGeometry(device));
    }

    static box(device) {
        return Mesh.fromGeometry(device, new BoxGeometry({ yOffset: 0.5 }));
    }

    static dome(device) {

        const geom = new DomeGeometry({
            latitudeBands: 50,
            longitudeBands: 50
        });

        // remove unused normals and uvs
        geom.normals = undefined;
        geom.uvs = undefined;

        return Mesh.fromGeometry(device, geom);
    }
}

export { SkyGeometry };
