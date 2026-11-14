import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
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
     * @param {string} text - The label.
     * @param {string} path - The path of the setting.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @returns {ReactElement} The slider.
     */
    const slider = (text, path, min, max) => (
        <LabelGroup text={text}>
            <SliderInput
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${path}` }}
                min={min}
                max={max}
                precision={2}
            />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The path of the setting.
     * @returns {ReactElement} The toggle.
     */
    const toggle = (text, path) => (
        <LabelGroup text={text}>
            <BooleanInput
                type='toggle'
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${path}` }}
            />
        </LabelGroup>
    );

    return (
        <>
            <Panel headerText='Lights'>
                {toggle('Area Lights', 'lights.areaLights')}
                {slider('Intensity', 'lights.intensity', 0, 3)}
                {slider('Bloom', 'lights.bloom', 0, 0.3)}
                {toggle('Animate', 'lights.animate')}
            </Panel>
            <Panel headerText='Floor'>
                {slider('Gloss', 'floor.gloss', 0, 1)}
                {slider('Metalness', 'floor.metalness', 0, 1)}
            </Panel>
        </>
    );
}
