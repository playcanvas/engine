import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
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
        <Panel headerText='Settings'>
            <LabelGroup text='Filter'>
                <SelectInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.shadowType' }}
                    type='number'
                    options={[
                        { v: pc.SHADOW_PCF1_32F, t: 'PCF1_32F' },
                        { v: pc.SHADOW_PCF3_32F, t: 'PCF3_32F' },
                        { v: pc.SHADOW_PCF5_32F, t: 'PCF5_32F' },
                        { v: pc.SHADOW_PCF1_16F, t: 'PCF1_16F' },
                        { v: pc.SHADOW_PCF3_16F, t: 'PCF3_16F' },
                        { v: pc.SHADOW_PCF5_16F, t: 'PCF5_16F' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Shadow Res'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.shadowAtlasResolution' }}
                    min={512}
                    max={4096}
                    precision={0}
                />
            </LabelGroup>
            <LabelGroup text='Shadows On'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.shadowsEnabled' }}
                    value={observer.get('settings.shadowsEnabled')}
                />
            </LabelGroup>
            <LabelGroup text='Cookies On'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.cookiesEnabled' }}
                    value={observer.get('settings.cookiesEnabled')}
                />
            </LabelGroup>
        </Panel>
    );
}
