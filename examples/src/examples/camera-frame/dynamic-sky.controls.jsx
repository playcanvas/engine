import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    /**
     * @param {string} path - The observer path suffix.
     * @param {number} min - Slider minimum.
     * @param {number} max - Slider maximum.
     * @param {number} precision - Slider precision.
     * @returns {ReactElement} The slider.
     */
    const slider = (path, min, max, precision) => (
        <SliderInput
            binding={new BindingTwoWay()}
            link={{ observer, path: `data.${path}` }}
            min={min}
            max={max}
            precision={precision}
        />
    );

    /**
     * @param {string} path - The observer path suffix.
     * @returns {ReactElement} The toggle.
     */
    const toggle = (path) => (
        <BooleanInput
            type='toggle'
            binding={new BindingTwoWay()}
            link={{ observer, path: `data.${path}` }}
        />
    );

    return (
        <>
            <Panel headerText='Time of Day'>
                <LabelGroup text='Hour'>{slider('time.hour', 0, 24, 2)}</LabelGroup>
                <LabelGroup text='Animate'>{toggle('time.animate')}</LabelGroup>
                <LabelGroup text='Speed'>{slider('time.speed', 0, 2, 2)}</LabelGroup>
            </Panel>
            <Panel headerText='Sky'>
                <LabelGroup text='Sun Intensity'>{slider('sky.sunIntensity', 0, 6, 2)}</LabelGroup>
                <LabelGroup text='Brightness'>{slider('sky.luminance', 0, 3, 2)}</LabelGroup>
                <LabelGroup text='Turbidity'>{slider('sky.turbidity', 1, 20, 1)}</LabelGroup>
                <LabelGroup text='Rayleigh'>{slider('sky.rayleigh', 0, 4, 2)}</LabelGroup>
                <LabelGroup text='Rotation'>{slider('sky.rotation', 0, 360, 0)}</LabelGroup>
            </Panel>
            <Panel headerText='Clouds'>
                <LabelGroup text='Type'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.clouds.type' }}
                        type='string'
                        options={[
                            { v: 'none', t: 'None' },
                            { v: 'flat', t: 'Flat' },
                            { v: 'volumetric', t: 'Volumetric' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Coverage'>{slider('clouds.coverage', 0, 1, 2)}</LabelGroup>
                <LabelGroup text='Softness'>{slider('clouds.softness', 0.05, 1, 2)}</LabelGroup>
                <LabelGroup text='Brightness'>{slider('clouds.brightness', 0, 2, 2)}</LabelGroup>
                <LabelGroup text='Quality'>{slider('clouds.quality', 0, 1, 2)}</LabelGroup>
                <LabelGroup text='Resolution'>{slider('clouds.resolution', 0.25, 1, 2)}</LabelGroup>
                <LabelGroup text='Wind Speed'>{slider('clouds.windSpeed', 0, 100, 0)}</LabelGroup>
                <LabelGroup text='Wind Dir'>{slider('clouds.windDirection', 0, 360, 0)}</LabelGroup>
                <LabelGroup text='Relight'>{slider('clouds.relight', 0, 0.1, 3)}</LabelGroup>
            </Panel>
            <Panel headerText='Auto Exposure'>
                <LabelGroup text='Enabled'>{toggle('autoExposure.enabled')}</LabelGroup>
                <LabelGroup text='Compensation'>
                    {slider('autoExposure.compensation', -3, 3, 1)}
                </LabelGroup>
            </Panel>
            <Panel headerText='Effects'>
                <LabelGroup text='Bloom'>{toggle('effects.bloom')}</LabelGroup>
                <LabelGroup text='TAA'>{toggle('effects.taa')}</LabelGroup>
            </Panel>
        </>
    );
}
