import { geodeticToCartesian , cartesianToGeodetic} from 'https://esm.sh/earthatile@1.0.0'
import * as pcui from 'https://esm.sh/@playcanvas/pcui'

export const attributes = {
    camera: { type: 'entity' }
};

export default class Geolocation {
    constructor(app, entity) {
        this.app = app;
        this.entity = entity;
    }

    teleport(lon, lat, alt) {
        const [x, y, z] = geodeticToCartesian(lon, lat, alt ?? 300);

        this.entity.setPosition(-x, -z, y);
        this.camera.setPosition(0, 0, 0);
    }

    // initialize code called once per entity
    initialize() {
        // Create a debug UI
        this.panel = new pcui.Panel({
            collapsible: true,
            headerText: 'CONTROLS',
            hiddern: true,
            width: 400
        });
        document.body.appendChild(this.panel.dom);

        this.longLat = new pcui.VectorInput({
            dimensions: 2,
            readOnly: true
        });
        let group = new pcui.LabelGroup({
            text: 'Geodetic Coord',
            field: this.longLat
        });
        this.panel.append(group);

        const destInput = new pcui.TextInput();
        destInput.on('change', (value) => {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${value}`)
                .then(response => response.json())
                .then((data) => {
                    if (data.length > 0) {
                        const latitude = data[0].lat;
                        const longitude = data[0].lon;
                        this.teleport(longitude, latitude);
                    } else {
                        console.log('No results found');
                    }
                })
                .catch(error => console.error('Error:', error));
        });
        group = new pcui.LabelGroup({
            text: 'Destination',
            field: destInput
        });
        this.panel.append(group);

        const geoButton = new pcui.Button({
            text: 'Geolocate'
        });
        geoButton.on('click', () => {
            navigator.geolocation.getCurrentPosition((pos) => {
                const { longitude, latitude, altitude } = pos.coords;
                this.teleport(longitude, latitude, altitude);
            });
        });
        group = new pcui.LabelGroup({
            text: '',
            field: geoButton
        });
        this.panel.append(group);
    }

    // update code called every frame
    update(dt) {
        if (this.camera) {
            const pos = this.camera.getPosition().clone();
            const offset = this.entity.getPosition();
            pos.sub(offset);
            const [lon, lat] = cartesianToGeodetic(pos.x, pos.y, pos.z);
            this.longLat.value = [lon, lat];
        }
    }
}
