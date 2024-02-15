import { Component } from 'react';

import { fragment, jsx } from '../jsx.mjs';

// eslint-disable-next-line jsdoc/require-property
/**
 * @typedef {object} Props
 * @property {import('react').ReactNode} children - The children.
 */

/**
 * @typedef {object} State
 * @property {boolean} hasError - Has an error.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class ErrorBoundary extends TypedComponent {
    /**
     * @param {any} props - The properties.
     */
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    /**
     * @returns {object} - The state.
     */
    static getDerivedStateFromError() {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    /**
     * @param {any} error - The error.
     * @param {any} errorInfo - The error info.
     */
    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        // logErrorToMyService(error, errorInfo);
        console.warn(error, errorInfo);
    }

    resetState() {
        console.log('reset error');
        this.setState({ hasError: false });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            // return <h1>Something went wrong.</h1>;
            return fragment(
                jsx('pre', null, 'Something went wrong.'),
                jsx(
                    'button',
                    {
                        onClick: this.resetState.bind(this)
                    },
                    'retry'
                )
            );
        }
        return this.props.children;
    }
}
export { ErrorBoundary };
