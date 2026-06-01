import {
    BindingTwoWay,
    BooleanInput,
    SelectInput,
    LabelGroup,
    Panel,
    SliderInput
} from '@playcanvas/pcui/react';

import * as pc from 'playcanvas';

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
                        { v: pc.TONEMAP_LINEAR, t: 'LINEAR' },
                        { v: pc.TONEMAP_FILMIC, t: 'FILMIC' },
                        { v: pc.TONEMAP_HEJL, t: 'HEJL' },
                        { v: pc.TONEMAP_ACES, t: 'ACES' },
                        { v: pc.TONEMAP_ACES2, t: 'ACES2' },
                        { v: pc.TONEMAP_NEUTRAL, t: 'NEUTRAL' }
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
