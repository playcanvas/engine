import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
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
        <>
            <Panel headerText='Fog'>
                <LabelGroup text='Density'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.density' }}
                        min={0}
                        max={0.2}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Brightness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.brightness' }}
                        min={0}
                        max={4}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Volume'>
                <LabelGroup text='Dynamic'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.dynamic' }}
                    />
                </LabelGroup>
                <LabelGroup text='Mipmaps'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.mipmaps' }}
                    />
                </LabelGroup>
                <LabelGroup text='Mip level'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.mipLevel' }}
                        min={0}
                        max={7}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
