import {
    BindingTwoWay,
    BooleanInput,
    SelectInput,
    LabelGroup,
    Panel,
    SliderInput
} from '@playcanvas/pcui/react';

import {
    TONEMAP_ACES,
    TONEMAP_ACES2,
    TONEMAP_FILMIC,
    TONEMAP_HEJL,
    TONEMAP_LINEAR,
    TONEMAP_NEUTRAL
} from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
            <Panel headerText='Rendering'>
                <LabelGroup text='HDR'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.hdr' }}
                    />
                </LabelGroup>
            </Panel>
            <LabelGroup text='Scene Tonemap'>
                <SelectInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.sceneTonemapping' }}
                    type='number'
                    options={[
                        { v: TONEMAP_LINEAR, t: 'LINEAR' },
                        { v: TONEMAP_FILMIC, t: 'FILMIC' },
                        { v: TONEMAP_HEJL, t: 'HEJL' },
                        { v: TONEMAP_ACES, t: 'ACES' },
                        { v: TONEMAP_ACES2, t: 'ACES2' },
                        { v: TONEMAP_NEUTRAL, t: 'NEUTRAL' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='LUT Intensity'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.colorLutIntensity' }}
                    min={0}
                    max={1}
                    precision={2}
                />
            </LabelGroup>
        </>
    );
}
