import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    SliderInput,
    BooleanInput,
    SelectInput
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
            <Panel headerText='Settings'>
                <LabelGroup text='Opacity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.opacity' }}
                        min={0.0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Alpha Dither'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.alphaDither' }}
                        min={0.0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Dither Color'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.opacityDither' }}
                        type='string'
                        options={[
                            { v: pc.DITHER_NONE, t: 'None' },
                            { v: pc.DITHER_BAYER8, t: 'Bayer8' },
                            { v: pc.DITHER_BLUENOISE, t: 'BlueNoise' },
                            { v: pc.DITHER_IGNNOISE, t: 'IGNNoise' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Dither Shadow'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.opacityShadowDither' }}
                        type='string'
                        options={[
                            { v: pc.DITHER_NONE, t: 'None' },
                            { v: pc.DITHER_BAYER8, t: 'Bayer8' },
                            { v: pc.DITHER_BLUENOISE, t: 'BlueNoise' },
                            { v: pc.DITHER_IGNNOISE, t: 'IGNNoise' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='TAA (WIP)'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.taa' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
