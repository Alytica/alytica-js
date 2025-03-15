export interface AlyticaCookie {
  $distinctId: string;
  $session: Session;
  $initialUserProperties: InitialUserProperties;
  $isIdentified: boolean;
}

export interface Session {
  $sessionId: string;
  $lastTimestamp: number;
  $startTimestamp: number;
  $eventCount: number;
  $lastPath: string;
}

export interface InitialUserProperties {
  initialReferrer: string;
  initialPath: string;
  initialTimestamp: number;
  initialViewportWidth: number;
  initialViewportHeight: number;
  initialUserAgent: string;
}

export interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  maxRetries?: number;
  initialRetryDelay?: number;
}

export interface TrackingClientConfig {
  clientId: string;
  clientSecret?: string;
  debug?: boolean;
  disabled?: boolean;
  waitForProfile?: boolean;
  processProfiles?: boolean;
}

export interface WebTrackingClientConfig extends TrackingClientConfig {
  trackPageViews?: boolean;
  trackOutgoingLinks?: boolean;
  trackAttributes?: boolean;
  trackHashChanges?: boolean;
  trackWebVitals?: boolean;
}
