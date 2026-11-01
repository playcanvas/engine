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
    return (
        <Panel headerText='Floor Reflection'>
            <LabelGroup text='Reflection'>
                <SelectInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.reflection' }}
                    type='string'
                    options={[
                        { v: 'planar', t: 'Planar' },
                        { v: 'cubemap', t: 'Cubemap' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Resolution'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.resolution' }}
                    min={0.1}
                    max={1}
                    precision={2}
                />
            </LabelGroup>
            <LabelGroup text='Roughness'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.roughness' }}
                    min={0}
                    max={0.6}
                    precision={2}
                />
            </LabelGroup>
            <LabelGroup text='Show Texture'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.showTexture' }}
                />
            </LabelGroup>
            <LabelGroup text='Speed'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.speed' }}
                    min={0}
                    max={3}
                    precision={2}
                />
            </LabelGroup>
        </Panel>
    );
}
