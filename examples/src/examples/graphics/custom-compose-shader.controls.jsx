import { BindingTwoWay, SelectInput, LabelGroup, SliderInput } from '@playcanvas/pcui/react';

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
            <LabelGroup text='Tonemap'>
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
            <LabelGroup text='Pixel Size'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.pixelSize' }}
                    min={8}
                    max={20}
                    precision={0}
                />
            </LabelGroup>
            <LabelGroup text='Intensity'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.pixelationIntensity' }}
                    min={0}
                    max={1}
                    precision={2}
                />
            </LabelGroup>
        </>
    );
}
