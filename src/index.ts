import { WebTrackingClient } from "./web-tracking";
import { TrackingClient } from "./tracking";
import { WebTrackingClientConfig } from "./types";

/**
 * Alytica main class - provides web analytics tracking functionality
 */
export class Alytica {
  private client: TrackingClient | WebTrackingClient;

  /**
   * Create a new Alytica tracking instance
   * @param options Configuration options for the Alytica SDK
   */
  constructor(options: WebTrackingClientConfig) {
    // Initialize the web tracking client with provided options
    this.client = new WebTrackingClient(options);
  }

  /**
   * Track a custom event
   * @param eventName Name of the event to track
   * @param properties Optional properties to include with the event
   * @returns Promise resolving to the tracking response
   */
  track(eventName: string, properties?: Record<string, any>): Promise<any> {
    return this.client.track(eventName, properties);
  }

  /**
   * Identify a user with a unique ID and optional properties
   * @param userId Unique identifier for the user
   * @param properties Optional user properties to associate with the user
   * @returns Promise resolving to the identify response
   */
  identify(userId: string, properties?: Record<string, any>): Promise<any> {
    return this.client.identify(userId, properties);
  }

  /**
   * Associate an anonymous user with a known user ID
   * @param userId The known user ID
   * @param aliasId The ID to alias to the user ID
   * @returns Promise resolving to the alias response
   */
  alias(userId: string, aliasId: string): Promise<any> {
    return this.client.alias(userId, aliasId);
  }

  /**
   * Get the current anonymous or known user ID
   * @returns The distinct ID of the current user
   */
  getDistinctId(): string {
    return this.client.getDistinctId();
  }

  /**
   * Reset the current user to a new anonymous user
   * @returns The new distinct ID
   */
  reset(): string {
    return this.client.reset();
  }

  /**
   * Set properties that will be included with every event
   * @param properties Properties to include with every event
   */
  setGlobalProperties(properties: Record<string, any>): void {
    this.client.setGlobalProperties(properties);
  }
}

// Re-export types that might be useful for consumers
export * from "./types";
