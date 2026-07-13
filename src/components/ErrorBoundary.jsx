import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="app-error">
          <section>
            <h1>BillSheet needs a refresh</h1>
            <p>An unexpected screen error occurred. Reload to try again.</p>
            <code className="error-detail">
              {this.state.error.message || "Unknown application error"}
            </code>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload app
            </button>
          </section>
        </div>
      );
    return this.props.children;
  }
}
