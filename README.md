# Alytica JS SDK

Alytica JS SDK is a JavaScript library for web analytics tracking. It provides functionalities to track custom events, identify users, and manage sessions. The SDK is designed to be used in web applications and supports integration with React.

## Features

- Track custom events
- Identify users
- Manage sessions
- Track web vitals
- Track page views
- Track outgoing links
- Track attributes
- React integration

## Installation

Install the package using npm:

```sh
npm install alytica-js-beta
```

## Usage

### Basic Usage

```ts
import { Alytica } from "alytica-js-beta";

const alytica = new Alytica({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  debug: true,
  trackPageViews: true,
  trackOutgoingLinks: true,
  trackAttributes: true,
  trackWebVitals: true,
  trackSessionEnds: true,
});

// Track a custom event
alytica.track("event_name", { property: "value" });

// Identify a user
alytica.identify("user_id", { property: "value" });

// Get the current distinct ID
const distinctId = alytica.getDistinctId();

// Reset the current user
alytica.reset();
```

### React Integration

The SDK provides a React context and hooks for easy integration with React applications.

#### AlyticaProvider

Wrap your application with `AlyticaProvider` to provide the Alytica instance to your components.

```tsx
import React from "react";
import { AlyticaProvider } from "alytica-js-beta/react";

const options = {
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  debug: true,
  trackPageViews: true,
  trackOutgoingLinks: true,
  trackAttributes: true,
  trackWebVitals: true,
  trackSessionEnds: true,
};

function App() {
  return (
    <AlyticaProvider options={options}>
      {/* Your application components */}
    </AlyticaProvider>
  );
}

export default App;
```

#### useAlytica Hook

Use the `useAlytica` hook to access the Alytica instance in your components.

```tsx
import React from "react";
import { useAlytica } from "alytica-js-beta/react";

function MyComponent() {
  const alytica = useAlytica();

  const handleClick = () => {
    alytica.track("button_click", { button: "my_button" });
  };

  return <button onClick={handleClick}>Click me</button>;
}

export default MyComponent;
```

## Configuration

The Alytica SDK can be configured using the following options:

- `clientId`: Your client ID (required)
- `clientSecret`: Your client secret (optional)
- `debug`: Enable debug mode (optional)
- `trackPageViews`: Enable automatic page view tracking (optional)
- `trackOutgoingLinks`: Enable automatic tracking of outgoing links (optional)
- `trackAttributes`: Enable automatic tracking of attributes (optional)
- `trackHashChanges`: Enable tracking of hash changes (optional)
- `trackWebVitals`: Enable tracking of web vitals (optional)
- `trackSessionEnds`: Enable tracking of session ends (optional)

## License

This project is licensed under the MIT License.

[MIT License](LICENSE)