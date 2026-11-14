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
     * @param {string} text - The label.
     * @param {string} path - The observer path.
     * @returns {ReactElement} A toggle bound to the path.
     */
    const toggle = (text, path) => (
        <LabelGroup text={text}>
            <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer, path }} />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The observer path.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @param {number} precision - The number of decimals.
     * @returns {ReactElement} A slider bound to the path.
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

    return (
        <>
            <Panel headerText='Cutaway'>
                {toggle('Enabled', 'data.cut.enabled')}
                {slider('Opening', 'data.cut.opening', 0, 180, 0)}
                {slider('Rotation', 'data.cut.rotation', -180, 180, 0)}
                {slider('Length', 'data.cut.length', 0, 1, 2)}
                {toggle('Section caps', 'data.cut.caps')}
                {toggle('Spin', 'data.spin')}
            </Panel>
            <Panel headerText='Post Effects'>
                <LabelGroup text='Anti-aliasing'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.effects.aa' }}
                        type='string'
                        options={[
                            { v: 'msaa', t: 'MSAA' },
                            { v: 'smaa', t: 'SMAA' },
                            { v: 'taa', t: 'TAA' },
                            { v: 'none', t: 'None' }
                        ]}
                    />
                </LabelGroup>
                {toggle('Bloom', 'data.effects.bloom')}
                {toggle('Ambient occlusion', 'data.effects.ssao')}
                {toggle('Vignette', 'data.effects.vignette')}
            </Panel>
        </>
    );
}
