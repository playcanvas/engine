import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
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
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fog' }}
                        type='string'
                        options={[
                            { v: pc.FOG_NONE, t: 'NONE' },
                            { v: pc.FOG_LINEAR, t: 'LINEAR' },
                            { v: pc.FOG_EXP, t: 'EXP' },
                            { v: pc.FOG_EXP2, t: 'EXP2' }
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
