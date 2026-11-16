import {
    BindingTwoWay,
    BooleanInput,
    Button,
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
     * @param {string} path - The path of the value in the data.
     * @param {number} min - The minimum.
     * @param {number} max - The maximum.
     * @param {number} precision - The number of decimals.
     * @returns {ReactElement} The slider.
     */
    const slider = (text, path, min, max, precision) => (
        <LabelGroup text={text}>
            <SliderInput
                binding={new BindingTwoWay()}
                link={{ observer, path }}
                min={min}
                max={max}
                precision={precision}
            />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The path of the value in the data.
     * @returns {ReactElement} The toggle.
     */
    const toggle = (text, path) => (
        <LabelGroup text={text}>
            <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer, path }} />
        </LabelGroup>
    );

    return (
        <>
            <Panel headerText='Simulation'>
                {toggle('Play', 'data.play')}
                {slider('Speed', 'data.speed', 0, 60, 1)}
                {slider('Inflow', 'data.inflow', 0.002, 0.1, 3)}
                {toggle('Lensing', 'data.lensing')}
                {slider('Photon ring', 'data.ring', 0, 3, 2)}
                {slider('Doppler', 'data.doppler', 0, 1, 2)}
            </Panel>
            <Panel headerText='View'>
                <Button text='Side' onClick={() => observer.emit('view:side')} />
                <Button text='Edge on' onClick={() => observer.emit('view:edge')} />
                <Button text='Top' onClick={() => observer.emit('view:top')} />
            </Panel>
            <Panel headerText='Look' collapsible collapsed>
                {slider('Temperature (K)', 'data.temperature', 3000, 30000, 0)}
                {slider('Brightness', 'data.brightness', 0.1, 5, 2)}
                {slider('Disk opacity', 'data.diskOpacity', 0.05, 1, 2)}
                {slider('Brightness falloff', 'data.falloff', 0, 4, 2)}
                {slider('Background', 'data.background', 0, 3, 2)}
                {slider('Exposure', 'data.exposure', 0.1, 5, 2)}
                {slider('Bloom', 'data.bloom', 0, 0.2, 3)}
            </Panel>
        </>
    );
}
