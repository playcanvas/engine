import { Component } from "react";
import { fragment, jsx } from "./jsx.mjs";
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    //logErrorToMyService(error, errorInfo);
    console.warn(error, errorInfo);
  }
  resetState() {
    console.log("reset error");
    this.setState({hasError: false})
  }
  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      //return <h1>Something went wrong.</h1>;
      return fragment(
        jsx("pre", null, "Something went wrong."),
        jsx(
          'button',
          {
            onClick: this.resetState.bind(this),
          },
          'retry'
        )
      );
    }
    return this.props.children; 
  }
}
export {
    ErrorBoundary
};
