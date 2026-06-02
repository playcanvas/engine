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
                <LabelGroup text='Color'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.color' }}
                        min={0.0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Metalness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.metalness' }}
                        min={0.0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Tonemapping'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.tonemapping' }}
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
                <LabelGroup text='Fog'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fog' }}
                    />
                </LabelGroup>
                <LabelGroup text='Toon'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.toon' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
