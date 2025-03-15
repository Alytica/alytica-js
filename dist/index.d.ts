interface AlyticaCookie {
    $distinctId: string;
    $session: Session;
    $initialUserProperties: InitialUserProperties;
    $isIdentified: boolean;
}
interface Session {
    $sessionId: string;
    $lastTimestamp: number;
    $startTimestamp: number;
    $eventCount: number;
    $lastPath: string;
}
interface InitialUserProperties {
    initialReferrer: string;
    initialPath: string;
    initialTimestamp: number;
    initialViewportWidth: number;
    initialViewportHeight: number;
    initialUserAgent: string;
}
interface ApiClientConfig {
    baseUrl: string;
    defaultHeaders?: Record<string, string>;
    maxRetries?: number;
    initialRetryDelay?: number;
}
interface TrackingClientConfig {
    clientId: string;
    clientSecret?: string;
    debug?: boolean;
    disabled?: boolean;
    waitForProfile?: boolean;
    processProfiles?: boolean;
}
interface WebTrackingClientConfig extends TrackingClientConfig {
    trackPageViews?: boolean;
    trackOutgoingLinks?: boolean;
    trackAttributes?: boolean;
    trackHashChanges?: boolean;
    trackWebVitals?: boolean;
}

/**
 * Alytica main class - provides web analytics tracking functionality
 */
declare class Alytica {
    private client;
    /**
     * Create a new Alytica tracking instance
     * @param options Configuration options for the Alytica SDK
     */
    constructor(options: WebTrackingClientConfig);
    /**
     * Track a custom event
     * @param eventName Name of the event to track
     * @param properties Optional properties to include with the event
     * @returns Promise resolving to the tracking response
     */
    track(eventName: string, properties?: Record<string, any>): Promise<any>;
    /**
     * Identify a user with a unique ID and optional properties
     * @param userId Unique identifier for the user
     * @param properties Optional user properties to associate with the user
     * @returns Promise resolving to the identify response
     */
    identify(userId: string, properties?: Record<string, any>): Promise<any>;
    /**
     * Associate an anonymous user with a known user ID
     * @param userId The known user ID
     * @param aliasId The ID to alias to the user ID
     * @returns Promise resolving to the alias response
     */
    alias(userId: string, aliasId: string): Promise<any>;
    /**
     * Get the current anonymous or known user ID
     * @returns The distinct ID of the current user
     */
    getDistinctId(): string;
    /**
     * Reset the current user to a new anonymous user
     * @returns The new distinct ID
     */
    reset(): string;
    /**
     * Set properties that will be included with every event
     * @param properties Properties to include with every event
     */
    setGlobalProperties(properties: Record<string, any>): void;
}

export { Alytica, type AlyticaCookie, type ApiClientConfig, type InitialUserProperties, type Session, type TrackingClientConfig, type WebTrackingClientConfig };
