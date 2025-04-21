import { ApiClient } from "./api";
import { cookieManager } from "./cookie";
import {
  AlyticaCookie,
  InitialUserProperties,
  Session,
  TrackingClientConfig,
} from "./types";

export interface ITrackingClient {
  track: (eventName: string, properties?: Record<string, any>) => Promise<any>;
  identify: (userId: string, properties?: Record<string, any>) => Promise<any>;
  alias: (userId: string, aliasId: string) => Promise<any>;
  getDistinctId: () => string;
  reset: () => string;
  setGlobalProperties: (properties: Record<string, any>) => void;
}

export class TrackingClient implements ITrackingClient {
  protected options: TrackingClientConfig;
  protected queue: any[];
  protected isIdentified: boolean;
  protected global: Record<string, any>;

  protected api: ApiClient;
  protected distinctId!: string;
  protected sessionId!: string;
  protected initialUserProperties!: InitialUserProperties;
  protected alyticaCookie!: AlyticaCookie;

  constructor(config: TrackingClientConfig) {
    this.options = config;
    this.queue = [];
    this.isIdentified = false;
    this.global = {};

    const headers: Record<string, string> = {
      "alytica-client-id": config.clientId,
    };

    if (config.clientSecret) {
      headers["alytica-client-secret"] = config.clientSecret;
    }

    this.api = new ApiClient({
      baseUrl: this.options.api_host || "https://api.alytica.tech",
      defaultHeaders: headers,
    });

    if (!this.isServer()) {
      const alyticaCookie = cookieManager.get(
        `alytica_${this.options.clientId}`
      ) as AlyticaCookie;
      this.alyticaCookie = alyticaCookie;

      if (!alyticaCookie || !alyticaCookie.$initialUserProperties) {
        // Generate new IDs if no cookie exists
        this.distinctId = cookieManager.generateId();
        this.sessionId = cookieManager.generateId();
        this.initialUserProperties = {
          initialReferrer: document.referrer,
          initialPath: window.location.href,
          initialTimestamp: Date.now(),
          initialViewportWidth: window.innerWidth,
          initialViewportHeight: window.innerHeight,
          initialUserAgent: navigator.userAgent,
        };

        // Set up new cookie with empty groups
        this.alyticaCookie = {
          $distinctId: this.distinctId,
          $session: {
            $sessionId: this.sessionId,
            $lastTimestamp: Date.now(),
            $startTimestamp: Date.now(),
            $eventCount: 0,
            $lastPath: window.location.href,
          },
          $initialUserProperties: this.initialUserProperties,
          $isIdentified: false,
          $groups: {}, // Initialize empty groups object
        };

        cookieManager.set(
          `alytica_${this.options.clientId}`,
          this.alyticaCookie
        );
      } else {
        this.distinctId = alyticaCookie.$distinctId;
        this.session = alyticaCookie.$session;
        this.initialUserProperties = alyticaCookie.$initialUserProperties;

        // Ensure groups exist in cookie
        if (!alyticaCookie.$groups) {
          alyticaCookie.$groups = {};
        }

        if (Date.now() - this.session.$lastTimestamp > 30 * 60 * 1000) {
          this.sessionId = cookieManager.generateId();

          // Update cookie with new session
          this.alyticaCookie = {
            $distinctId: this.distinctId,
            $session: {
              $sessionId: this.sessionId,
              $lastTimestamp: Date.now(),
              $startTimestamp: Date.now(),
              $eventCount: 0,
              $lastPath: window.location.href,
            },
            $initialUserProperties: this.initialUserProperties,
            $isIdentified: false,
            $groups: alyticaCookie.$groups || {}, // Preserve groups
          };

          cookieManager.set(
            `alytica_${this.options.clientId}`,
            this.alyticaCookie
          );
        } else {
          this.alyticaCookie = {
            $distinctId: this.distinctId,
            $session: { ...this.session, $lastTimestamp: Date.now() },
            $initialUserProperties: this.initialUserProperties,
            $isIdentified: this.isIdentified,
            $groups: alyticaCookie.$groups || {}, // Preserve groups
          };

          cookieManager.set(
            `alytica_${this.options.clientId}`,
            this.alyticaCookie
          );
        }
      }
    }
  }

  protected isServer(): boolean {
    return typeof window === "undefined";
  }

  protected isTrackingDisabled(): boolean {
    if (this.isServer()) return false;
    return localStorage.getItem("alytica_disabled") === "true";
  }

  init(): void {
    if (this.isTrackingDisabled()) {
      return;
    }
    if (this.options.debug) {
      console.log(
        "%c   ___    __      __  _           \n" +
          "  /   |  / /_  __/ /_(_)________ _\n" +
          " / /| | / / / / / __/ / ___/ __ '/\n" +
          "/ ___ |/ / /_/ / /_/ / /__/ /_/ / \n" +
          "/_/  |_/_/\\__, /\\__/_/\\___/\\__._/  \n" +
          "         /____/           ",
        "color: orange;"
      );
    }
  }

  ready(): void {
    this.flush();
  }

  async send(event: any): Promise<any> {
    if (this.options.disabled) {
      return Promise.resolve();
    }

    if (this.options.debug) {
      console.log("Event Data: ", event);
    }
    return this.api.fetch("/api/track", event);
  }

  setGlobalProperties(properties: Record<string, any>): void {
    this.global = { ...this.global, ...properties };
  }
  async group(
    groupType: string,
    groupValue: string,
    properties?: Record<string, any>
  ): Promise<any> {
    // Get the latest cookie data
    this.alyticaCookie =
      cookieManager.get(`alytica_${this.options.clientId}`) ||
      this.alyticaCookie;

    // Ensure groups exist
    if (!this.alyticaCookie.$groups) {
      this.alyticaCookie.$groups = {};
    }

    // Set the group value
    this.alyticaCookie.$groups[groupType] = groupValue;
    await this.send({
      type: "group",
      payload: {
        $groupKey: groupType,
        $groupValue: groupValue,
        properties: {
          ...properties,
        },
      },
    });
    // Update the cookie
    cookieManager.set(`alytica_${this.options.clientId}`, this.alyticaCookie);
  }

  async track(
    eventName: string,
    properties?: Record<string, any>
  ): Promise<any> {
    if (this.isTrackingDisabled()) {
      return Promise.resolve();
    }
    this.alyticaCookie =
      (cookieManager.get(
        `alytica_${this.options.clientId}`
      ) as AlyticaCookie) || this.alyticaCookie;
    const currentSession = this.alyticaCookie.$session;

    const eventCount = currentSession.$eventCount + 1;

    this.alyticaCookie = {
      $distinctId: this.alyticaCookie.$distinctId || this.distinctId,
      $session: {
        $sessionId: currentSession.$sessionId || this.sessionId,
        $lastTimestamp: Date.now(),
        $startTimestamp: currentSession.$startTimestamp,
        $eventCount: eventCount,
        $lastPath: window.location.href,
      },
      $groups: this.alyticaCookie.$groups,
      $initialUserProperties: this.alyticaCookie.$initialUserProperties,
      $isIdentified: this.alyticaCookie.$isIdentified,
    };

    cookieManager.set(`alytica_${this.options.clientId}`, this.alyticaCookie);

    return this.send({
      type: "track",
      payload: {
        name: eventName,
        properties: {
          $distinctId: this.distinctId,
          $sessionId: currentSession.$sessionId,
          $processProfiles: this.options.processProfiles,
          $isIdentified: this.alyticaCookie.$isIdentified,
          $initialUserProperties: this.alyticaCookie.$initialUserProperties,
          $groups: this.alyticaCookie.$groups, // Include groups in all track events

          ...(this.global ?? {}),
          ...(properties ?? {}),
        },
      },
    });
  }

  async identify(
    userId: string,
    properties?: Record<string, any>
  ): Promise<any> {
    if (this.isTrackingDisabled()) {
      return Promise.resolve();
    }
    if (userId) {
      if (this.distinctId === userId) {
        return;
      }

      this.alyticaCookie =
        (cookieManager.get(
          `alytica_${this.options.clientId}`
        ) as AlyticaCookie) || this.alyticaCookie;

      if (this.alyticaCookie.$isIdentified === true) {
        return;
      }
      await this.send({
        type: "identify",
        payload: {
          $userId: userId,
          $anonId: this.distinctId,
          properties: {
            $initialUserProperties: this.alyticaCookie.$initialUserProperties,
            $groups: this.alyticaCookie.$groups,

            ...properties,
          },
        },
      });
      this.isIdentified = true;
      this.distinctId = userId;

      const session = this.alyticaCookie.$session;

      this.alyticaCookie = {
        $distinctId: this.distinctId,
        $session: {
          $sessionId: session.$sessionId,
          $lastTimestamp: Date.now(),
          $startTimestamp: session.$startTimestamp,
          $eventCount: session.$eventCount,
          $lastPath: session.$lastPath,
        },
        $groups: this.alyticaCookie.$groups, // Preserve groups
        $initialUserProperties: this.alyticaCookie.$initialUserProperties,
        $isIdentified: true,
      };

      cookieManager.set(`alytica_${this.options.clientId}`, this.alyticaCookie);
      this.flush();
    }
  }

  async alias(userId: string, aliasId: string): Promise<any> {
    if (this.isTrackingDisabled()) {
      return Promise.resolve();
    }
    if (userId) {
      if (aliasId === userId) {
        return;
      }

      await this.send({
        type: "alias",
        payload: {
          $distinctId: userId,
          $aliasId: aliasId,
        },
      });

      this.flush();
    }
  }

  getDistinctId(): string {
    return this.distinctId;
  }

  reset(): string {
    this.distinctId = cookieManager.generateId();
    this.sessionId = cookieManager.generateId();

    const newInitialUserProperties: InitialUserProperties = {
      initialReferrer: document.referrer === "" ? "$direct" : document.referrer,
      initialPath: window.location.href,
      initialTimestamp: Date.now(),
      initialViewportWidth: window.innerWidth,
      initialViewportHeight: window.innerHeight,
      initialUserAgent: navigator.userAgent,
    };

    this.alyticaCookie = {
      $distinctId: this.distinctId,
      $session: {
        $sessionId: this.sessionId,
        $lastTimestamp: Date.now(),
        $startTimestamp: Date.now(),
        $eventCount: 0,
        $lastPath: window.location.href,
      },
      $groups: {}, // Preserve groups

      $initialUserProperties: newInitialUserProperties,
      $isIdentified: false,
    };

    cookieManager.set(`alytica_${this.options.clientId}`, this.alyticaCookie);

    return this.distinctId;
  }

  flush(): void {
    this.queue.forEach((event) => {
      this.send({
        ...event,
        payload: {
          ...event.payload,
        },
      });
    });
    this.queue = [];
  }

  get session(): Session {
    return this.alyticaCookie?.$session;
  }

  set session(session: Session) {
    if (this.alyticaCookie) {
      this.alyticaCookie.$session = session;
    }
  }
}
