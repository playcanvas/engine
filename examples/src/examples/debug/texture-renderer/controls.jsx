import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput
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
    const toggle = (/** @type {string} */ path, /** @type {string} */ text) => (
        <LabelGroup text={text}>
            <BooleanInput
                type='toggle'
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${path}` }}
                value={observer.get(`settings.${path}`)}
            />
        </LabelGroup>
    );
    return (
        <Panel headerText='Texture previews'>
            {toggle('previews', 'Show Previews')}
            {toggle('animate', 'Animate Scene')}
            {toggle('swap', 'Swap Color Textures')}
            <LabelGroup text='Channels'>
                <SelectInput
                    type='string'
                    options={[
                        { v: 'rgb', t: 'RGB (color)' },
                        { v: 'rrr', t: 'Red' },
                        { v: 'ggg', t: 'Green' },
                        { v: 'bbb', t: 'Blue' },
                        { v: 'aaa', t: 'Alpha' },
                        { v: 'bgr', t: 'BGR' },
                        { v: 'rga', t: 'Red / Green / Alpha' }
                    ]}
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.channels' }}
                    value={observer.get('settings.channels')}
                />
            </LabelGroup>
        </Panel>
    );
}
