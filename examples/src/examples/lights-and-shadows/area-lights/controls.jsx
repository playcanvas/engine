import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

import {
    LIGHTSHAPE_DISK,
    LIGHTSHAPE_PUNCTUAL,
    LIGHTSHAPE_RECT,
    LIGHTSHAPE_SPHERE
} from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

const SHAPES = [
    { v: LIGHTSHAPE_RECT, t: 'Rectangle' },
    { v: LIGHTSHAPE_DISK, t: 'Disk' },
    { v: LIGHTSHAPE_SPHERE, t: 'Sphere' },
    { v: LIGHTSHAPE_PUNCTUAL, t: 'Punctual' }
];

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    /**
     * @param {string} path - The path of the setting.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @param {number} [precision] - The number of decimals.
     * @returns {ReactElement} The slider.
     */
    const slider = (path, min, max, precision = 2) => (
        <SliderInput
            binding={new BindingTwoWay()}
            link={{ observer, path: `settings.${path}` }}
            min={min}
            max={max}
            precision={precision}
        />
    );

    /**
     * @param {string} path - The path of the setting.
     * @returns {ReactElement} The toggle.
     */
    const toggle = (path) => (
        <BooleanInput
            type='toggle'
            binding={new BindingTwoWay()}
            link={{ observer, path: `settings.${path}` }}
        />
    );

    /**
     * @param {string} path - The path of the setting.
     * @returns {ReactElement} The color picker.
     */
    const color = (path) => (
        <ColorPicker binding={new BindingTwoWay()} link={{ observer, path: `settings.${path}` }} />
    );

    /**
     * @param {string} light - The name of the light in the settings.
     * @returns {ReactElement} The light shape select.
     */
    const shape = (light) => (
        <LabelGroup text='Shape'>
            <SelectInput
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${light}.shape` }}
                type='number'
                options={SHAPES}
            />
        </LabelGroup>
    );

    /**
     * @param {string} light - The name of the light in the settings.
     * @param {boolean} [hasShape] - Whether the light shape can be selected.
     * @returns {ReactElement} The controls shared by all lights.
     */
    const lightControls = (light, hasShape = true) => (
        <>
            <LabelGroup text='Enabled'>{toggle(`${light}.enabled`)}</LabelGroup>
            {hasShape && shape(light)}
            <LabelGroup text='Intensity'>{slider(`${light}.intensity`, 0, 10, 1)}</LabelGroup>
            <LabelGroup text='Shadows'>{toggle(`${light}.shadows`)}</LabelGroup>
        </>
    );

    return (
        <>
            <Panel headerText='Doors (Spot)'>
                {lightControls('doors')}
                <LabelGroup text='Width'>{slider('doors.width', 0.1, 1.8)}</LabelGroup>
                <LabelGroup text='Height'>{slider('doors.height', 0.1, 3.4)}</LabelGroup>
                <LabelGroup text='Left Color'>{color('doors.colorLeft')}</LabelGroup>
                <LabelGroup text='Middle Color'>{color('doors.colorMiddle')}</LabelGroup>
                <LabelGroup text='Right Color'>{color('doors.colorRight')}</LabelGroup>
            </Panel>
            <Panel headerText='Orb (Omni)'>
                {lightControls('orb')}
                <LabelGroup text='Size'>{slider('orb.size', 0.05, 1.5)}</LabelGroup>
                <LabelGroup text='Color'>{color('orb.color')}</LabelGroup>
            </Panel>
            <Panel headerText='Sun (Directional)'>
                {/* the shape and size of the sun barely show, so they are not offered */}
                {lightControls('sun', false)}
                <LabelGroup text='Elevation'>{slider('sun.elevation', 10, 90, 0)}</LabelGroup>
                <LabelGroup text='Azimuth'>{slider('sun.azimuth', 0, 360, 0)}</LabelGroup>
                <LabelGroup text='Color'>{color('sun.color')}</LabelGroup>
            </Panel>
            <Panel headerText='Material'>
                <LabelGroup text='Floor Roughness'>
                    {slider('material.floorRoughness', 0, 1)}
                </LabelGroup>
                <LabelGroup text='Sphere Roughness'>
                    {slider('material.sphereRoughness', 0, 1)}
                </LabelGroup>
                <LabelGroup text='Sphere Metalness'>
                    {slider('material.sphereMetalness', 0, 1)}
                </LabelGroup>
            </Panel>
            <Panel headerText='Scene'>
                <LabelGroup text='Animate'>{toggle('scene.animate')}</LabelGroup>
                <LabelGroup text='Bloom'>{toggle('scene.bloom')}</LabelGroup>
            </Panel>
        </>
    );
}
