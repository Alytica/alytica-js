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
  protected needsSessionStart: boolean;
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
    this.needsSessionStart = false;

    const headers: Record<string, string> = {
      "alytica-client-id": config.clientId,
    };

    if (config.clientSecret) {
      headers["alytica-client-secret"] = config.clientSecret;
    }

    this.api = new ApiClient({
      baseUrl: "http://localhost:3001",
      defaultHeaders: headers,
    });

    if (!this.isServer()) {
      const alyticaCookie = cookieManager.get(
        `alytica_${this.options.clientId}`
      ) as AlyticaCookie;
      this.alyticaCookie = alyticaCookie;

      if (!alyticaCookie || !alyticaCookie.$initialUserProperties) {
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
        };

        cookieManager.set(
          `alytica_${this.options.clientId}`,
          this.alyticaCookie
        );
        this.needsSessionStart = true;
      } else {
        this.distinctId = alyticaCookie.$distinctId;
        this.session = alyticaCookie.$session;
        this.initialUserProperties = alyticaCookie.$initialUserProperties;

        if (Date.now() - this.session.$lastTimestamp > 30 * 60 * 1000) {
          this.sessionId = cookieManager.generateId();

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
          };

          cookieManager.set(
            `alytica_${this.options.clientId}`,
            this.alyticaCookie
          );
          this.needsSessionStart = true;
        } else {
          this.alyticaCookie = {
            $distinctId: this.distinctId,
            $session: { ...this.session, $lastTimestamp: Date.now() },
            $initialUserProperties: this.initialUserProperties,
            $isIdentified: this.isIdentified,
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
    return typeof document === "undefined";
  }

  init(): void {
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

    if (this.needsSessionStart && !this.isServer()) {
      this.track("$session_start", { $path: window.location.href });
      this.needsSessionStart = false;
    }
  }

  ready(): void {
    this.options.waitForProfile = false;
    this.flush();
  }

  async send(event: any): Promise<any> {
    if (this.options.disabled) {
      return Promise.resolve();
    }

    if (this.options.waitForProfile) {
      this.queue.push(event);
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

  async track(
    eventName: string,
    properties?: Record<string, any>
  ): Promise<any> {
    this.alyticaCookie =
      (cookieManager.get(
        `alytica_${this.options.clientId}`
      ) as AlyticaCookie) || this.alyticaCookie;
    const currentSession = this.alyticaCookie.$session;

    let eventCount: number;
    if (eventName === "$session_end" || eventName === "$session_start") {
      eventCount = currentSession.$eventCount;
    } else {
      eventCount = currentSession.$eventCount + 1;
    }

    this.alyticaCookie = {
      $distinctId: this.alyticaCookie.$distinctId || this.distinctId,
      $session: {
        $sessionId: currentSession.$sessionId || this.sessionId,
        $lastTimestamp: Date.now(),
        $startTimestamp: currentSession.$startTimestamp,
        $eventCount: eventCount,
        $lastPath: window.location.href,
      },
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
        $initialUserProperties: this.alyticaCookie.$initialUserProperties,
        $isIdentified: true,
      };

      cookieManager.set(`alytica_${this.options.clientId}`, this.alyticaCookie);
      this.flush();
    }
  }

  async alias(userId: string, aliasId: string): Promise<any> {
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
