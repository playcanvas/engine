import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput
} from '@playcanvas/pcui/react';

import {
    FOG_EXP,
    FOG_EXP2,
    FOG_LINEAR,
    FOG_NONE,
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
            <Panel headerText='Settings'>
                <LabelGroup text='Tonemapping'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.tonemapping' }}
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
                <LabelGroup text='Fog'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fog' }}
                        type='string'
                        options={[
                            { v: FOG_NONE, t: 'NONE' },
                            { v: FOG_LINEAR, t: 'LINEAR' },
                            { v: FOG_EXP, t: 'EXP' },
                            { v: FOG_EXP2, t: 'EXP2' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Gamma'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.gamma' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
