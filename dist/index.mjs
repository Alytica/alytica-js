// src/web-tracking.ts
import { onCLS, onFCP, onINP, onLCP } from "web-vitals";

// src/cookie.ts
var cookieManager = {
  set(name, value, days = 365) {
    const date = /* @__PURE__ */ new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1e3);
    const expires = `expires=${date.toUTCString()}`;
    const encodedValue = encodeURIComponent(JSON.stringify(value));
    const cookieString = `${name}=${encodedValue};${expires};path=/;SameSite=Lax`;
    if (cookieString.length > 4093 * 0.9) {
      console.warn(
        "cookieStore warning: large cookie, len=" + cookieString.length
      );
      return;
    }
    document.cookie = cookieString;
  },
  get(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        const encodedValue = cookie.substring(nameEQ.length);
        const decodedValue = decodeURIComponent(encodedValue);
        return JSON.parse(decodedValue);
      }
    }
    return null;
  },
  generateId() {
    return crypto.randomUUID();
  }
};

// src/api.ts
var ApiClient = class {
  baseUrl;
  headers;
  maxRetries;
  initialRetryDelay;
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      ...config.defaultHeaders
    };
    this.maxRetries = config.maxRetries ?? 3;
    this.initialRetryDelay = config.initialRetryDelay ?? 500;
  }
  async resolveHeaders() {
    const resolvedHeaders = {};
    for (const [key, value] of Object.entries(this.headers)) {
      const resolvedValue = await value;
      if (resolvedValue !== null) {
        resolvedHeaders[key] = resolvedValue;
      }
    }
    return resolvedHeaders;
  }
  addHeader(key, value) {
    this.headers[key] = value;
  }
  async post(url, data, options = {}, retryCount = 0) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: await this.resolveHeaders(),
        body: JSON.stringify(data ?? {}),
        keepalive: true,
        ...options
      });
      if (response.status === 401) {
        return null;
      }
      if (response.status !== 200 && response.status !== 202) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.initialRetryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.post(url, data, options, retryCount + 1);
      }
      console.error("Max retries reached:", error);
      return null;
    }
  }
  async fetch(endpoint, data, options = {}) {
    const fullUrl = `${this.baseUrl}${endpoint}`;
    return this.post(fullUrl, data, options, 0);
  }
};

// src/tracking.ts
var TrackingClient = class {
  options;
  queue;
  isIdentified;
  global;
  needsSessionStart;
  api;
  distinctId;
  sessionId;
  initialUserProperties;
  alyticaCookie;
  constructor(config) {
    this.options = config;
    this.queue = [];
    this.isIdentified = false;
    this.global = {};
    this.needsSessionStart = false;
    const headers = {
      "alytica-client-id": config.clientId
    };
    if (config.clientSecret) {
      headers["alytica-client-secret"] = config.clientSecret;
    }
    this.api = new ApiClient({
      baseUrl: "http://localhost:3001",
      defaultHeaders: headers
    });
    if (!this.isServer()) {
      const alyticaCookie = cookieManager.get(
        `alytica_${this.options.clientId}`
      );
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
          initialUserAgent: navigator.userAgent
        };
        this.alyticaCookie = {
          $distinctId: this.distinctId,
          $session: {
            $sessionId: this.sessionId,
            $lastTimestamp: Date.now(),
            $startTimestamp: Date.now(),
            $eventCount: 0,
            $lastPath: window.location.href
          },
          $initialUserProperties: this.initialUserProperties,
          $isIdentified: false
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
        if (Date.now() - this.session.$lastTimestamp > 30 * 60 * 1e3) {
          this.sessionId = cookieManager.generateId();
          this.alyticaCookie = {
            $distinctId: this.distinctId,
            $session: {
              $sessionId: this.sessionId,
              $lastTimestamp: Date.now(),
              $startTimestamp: Date.now(),
              $eventCount: 0,
              $lastPath: window.location.href
            },
            $initialUserProperties: this.initialUserProperties,
            $isIdentified: false
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
            $isIdentified: this.isIdentified
          };
          cookieManager.set(
            `alytica_${this.options.clientId}`,
            this.alyticaCookie
          );
        }
      }
    }
  }
  isServer() {
    return typeof document === "undefined";
  }
  init() {
    if (this.options.debug) {
      console.log(
        "%c   ___    __      __  _           \n  /   |  / /_  __/ /_(_)________ _\n / /| | / / / / / __/ / ___/ __ '/\n/ ___ |/ / /_/ / /_/ / /__/ /_/ / \n/_/  |_/_/\\__, /\\__/_/\\___/\\__._/  \n         /____/           ",
        "color: orange;"
      );
    }
    if (this.needsSessionStart && !this.isServer()) {
      this.track("$session_start", { $path: window.location.href });
      this.needsSessionStart = false;
    }
  }
  ready() {
    this.options.waitForProfile = false;
    this.flush();
  }
  async send(event) {
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
  setGlobalProperties(properties) {
    this.global = { ...this.global, ...properties };
  }
  async track(eventName, properties) {
    this.alyticaCookie = cookieManager.get(
      `alytica_${this.options.clientId}`
    ) || this.alyticaCookie;
    const currentSession = this.alyticaCookie.$session;
    let eventCount;
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
        $lastPath: window.location.href
      },
      $initialUserProperties: this.alyticaCookie.$initialUserProperties,
      $isIdentified: this.alyticaCookie.$isIdentified
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
          ...this.global ?? {},
          ...properties ?? {}
        }
      }
    });
  }
  async identify(userId, properties) {
    if (userId) {
      if (this.distinctId === userId) {
        return;
      }
      this.alyticaCookie = cookieManager.get(
        `alytica_${this.options.clientId}`
      ) || this.alyticaCookie;
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
            ...properties
          }
        }
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
          $lastPath: session.$lastPath
        },
        $initialUserProperties: this.alyticaCookie.$initialUserProperties,
        $isIdentified: true
      };
      cookieManager.set(`alytica_${this.options.clientId}`, this.alyticaCookie);
      this.flush();
    }
  }
  async alias(userId, aliasId) {
    if (userId) {
      if (aliasId === userId) {
        return;
      }
      await this.send({
        type: "alias",
        payload: {
          $distinctId: userId,
          $aliasId: aliasId
        }
      });
      this.flush();
    }
  }
  getDistinctId() {
    return this.distinctId;
  }
  reset() {
    this.distinctId = cookieManager.generateId();
    this.sessionId = cookieManager.generateId();
    const newInitialUserProperties = {
      initialReferrer: document.referrer === "" ? "$direct" : document.referrer,
      initialPath: window.location.href,
      initialTimestamp: Date.now(),
      initialViewportWidth: window.innerWidth,
      initialViewportHeight: window.innerHeight,
      initialUserAgent: navigator.userAgent
    };
    this.alyticaCookie = {
      $distinctId: this.distinctId,
      $session: {
        $sessionId: this.sessionId,
        $lastTimestamp: Date.now(),
        $startTimestamp: Date.now(),
        $eventCount: 0,
        $lastPath: window.location.href
      },
      $initialUserProperties: newInitialUserProperties,
      $isIdentified: false
    };
    cookieManager.set(`alytica_${this.options.clientId}`, this.alyticaCookie);
    return this.distinctId;
  }
  flush() {
    this.queue.forEach((event) => {
      this.send({
        ...event,
        payload: {
          ...event.payload
        }
      });
    });
    this.queue = [];
  }
  get session() {
    return this.alyticaCookie?.$session;
  }
  set session(session) {
    if (this.alyticaCookie) {
      this.alyticaCookie.$session = session;
    }
  }
};

// src/web-tracking.ts
function toCamelCase(str) {
  return str.replace(
    /([-_][a-z])/gi,
    (match) => match.toUpperCase().replace("-", "").replace("_", "")
  );
}
var WebTrackingClient = class extends TrackingClient {
  options;
  // Change private to protected to match base class
  lastPath = "";
  lastHiddenTime = null;
  debounceTimer;
  constructor(options) {
    super({
      // Remove sdk and sdkVersion as they don't exist in TrackingClientConfig
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      debug: options.debug,
      disabled: options.disabled,
      waitForProfile: options.waitForProfile,
      processProfiles: options.processProfiles
    });
    this.options = options;
    if (!this.isServer()) {
      this.setGlobalProperties({
        $referrer: document.referrer === "" ? "$direct" : document.referrer,
        $screenWidth: window.screen.width,
        $screenHeight: window.screen.height,
        $viewportWidth: window.innerWidth,
        $viewportHeight: window.innerHeight,
        $language: navigator.language,
        $path: window.location.href,
        $title: document.title
      });
      this.init();
      if (this.options.trackWebVitals) {
        this.trackWebVitals();
      }
      if (this.options.trackPageViews) {
        this.trackPageViews();
        setTimeout(() => this.pageView(), 0);
      }
      if (this.options.trackOutgoingLinks) {
        this.trackOutgoingLinks();
      }
      if (this.options.trackAttributes) {
        this.trackAttributes();
      }
      this.setupTabCloseHandling();
    }
  }
  debounce(func, delay) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(func, delay);
  }
  trackWebVitals() {
    onCLS((metric) => {
      this.track("$web_vitals", {
        $metric_name: "CLS",
        $metric_value: metric.value,
        $metric_rating: metric.rating,
        $metric_delta: metric.delta
      });
    });
    onLCP((metric) => {
      this.track("$web_vitals", {
        $metric_name: "LCP",
        $metric_value: metric.value,
        $metric_rating: metric.rating,
        $metric_delta: metric.delta
      });
    });
    onFCP((metric) => {
      this.track("$web_vitals", {
        $metric_name: "FCP",
        $metric_value: metric.value,
        $metric_rating: metric.rating,
        $metric_delta: metric.delta
      });
    });
    onINP((metric) => {
      this.track("$web_vitals", {
        $metric_name: "INP",
        $metric_value: metric.value,
        $metric_rating: metric.rating,
        $metric_delta: metric.delta
      });
    });
  }
  trackOutgoingLinks() {
    if (this.isServer()) {
      return;
    }
    document.addEventListener("click", (event) => {
      const target = event.target;
      const link = target.closest("a");
      if (link && target) {
        const href = link.getAttribute("href");
        if (href?.startsWith("http")) {
          super.track("$linkOut", {
            href,
            text: link.innerText || link.getAttribute("title") || target.getAttribute("alt") || target.getAttribute("title")
          });
        }
      }
    });
  }
  trackPageViews() {
    if (this.isServer()) {
      return;
    }
    const originalPushState = history.pushState;
    history.pushState = function(data, unused, url) {
      const result = originalPushState.call(this, data, unused, url);
      window.dispatchEvent(new Event("pushstate"));
      window.dispatchEvent(new Event("locationchange"));
      return result;
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function(data, unused, url) {
      const result = originalReplaceState.call(this, data, unused, url);
      window.dispatchEvent(new Event("replacestate"));
      window.dispatchEvent(new Event("locationchange"));
      return result;
    };
    window.addEventListener("popstate", () => {
      window.dispatchEvent(new Event("locationchange"));
    });
    const handleLocationChange = () => this.debounce(() => this.pageView(), 200);
    if (this.options.trackHashChanges) {
      window.addEventListener("hashchange", handleLocationChange);
    } else {
      window.addEventListener("locationchange", handleLocationChange);
    }
  }
  trackAttributes() {
    if (this.isServer()) {
      return;
    }
    document.addEventListener("click", (event) => {
      const target = event.target;
      const button = target.closest("button");
      const link = target.closest("a");
      const trackElement = button?.getAttribute("data-track") ? button : link?.getAttribute("data-track") ? link : null;
      if (trackElement) {
        const properties = {};
        for (const attr of trackElement.attributes) {
          if (attr.name.startsWith("data-") && attr.name !== "data-track") {
            properties[toCamelCase(attr.name.replace(/^data-/, ""))] = attr.value;
          }
        }
        const eventName = trackElement.getAttribute("data-track");
        if (eventName) {
          super.track(eventName, properties);
        }
      }
    });
  }
  setupTabCloseHandling() {
    let isNavigatingAway = false;
    window.addEventListener("beforeunload", () => {
      if (!isNavigatingAway) {
        this.sendSessionEndEvent();
      }
    });
    window.addEventListener("popstate", () => {
      isNavigatingAway = true;
    });
    const links = document.querySelectorAll("a");
    links.forEach((link) => {
      link.addEventListener("click", () => {
        isNavigatingAway = true;
      });
    });
  }
  sendSessionEndEvent() {
    const alyticaCookie = cookieManager.get(`alytica_${this.options.clientId}`);
    if (alyticaCookie && alyticaCookie.$session) {
      const session = alyticaCookie.$session;
      if (session.$eventCount > 0) {
        const eventData = {
          type: "track",
          payload: {
            name: "$session_end",
            properties: {
              $distinctId: alyticaCookie.$distinctId,
              $sessionId: session.$sessionId,
              $bounce: session.$eventCount <= 1,
              $duration: Date.now() - session.$startTimestamp,
              $path: session.$lastPath,
              $isIdentified: alyticaCookie.$isIdentified,
              $initialUserProperties: alyticaCookie.$initialUserProperties,
              ...this.global || {}
            }
          }
        };
        const url = `${this.api.baseUrl}/api/track`;
        this.fallbackFetch(url, eventData);
      }
    }
  }
  fallbackFetch(url, data) {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "alytica-client-id": this.options.clientId,
        ...this.options.clientSecret ? { "alytica-client-secret": this.options.clientSecret } : {}
      },
      body: JSON.stringify(data),
      keepalive: true
    }).catch((error) => {
      console.error("Error sending session end event:", error);
    });
  }
  pageView(path, properties) {
    if (this.isServer()) {
      return;
    }
    let currentPath;
    let currentProperties;
    if (typeof path === "string") {
      currentPath = path;
      currentProperties = properties;
    } else {
      currentPath = window.location.href;
      currentProperties = path;
    }
    if (this.lastPath !== currentPath) {
      this.lastPath = currentPath;
      super.track("$pageview", {
        ...currentProperties ?? {}
      });
    }
  }
};

// src/index.ts
var Alytica = class {
  client;
  /**
   * Create a new Alytica tracking instance
   * @param options Configuration options for the Alytica SDK
   */
  constructor(options) {
    this.client = new WebTrackingClient(options);
  }
  /**
   * Track a custom event
   * @param eventName Name of the event to track
   * @param properties Optional properties to include with the event
   * @returns Promise resolving to the tracking response
   */
  track(eventName, properties) {
    return this.client.track(eventName, properties);
  }
  /**
   * Identify a user with a unique ID and optional properties
   * @param userId Unique identifier for the user
   * @param properties Optional user properties to associate with the user
   * @returns Promise resolving to the identify response
   */
  identify(userId, properties) {
    return this.client.identify(userId, properties);
  }
  /**
   * Associate an anonymous user with a known user ID
   * @param userId The known user ID
   * @param aliasId The ID to alias to the user ID
   * @returns Promise resolving to the alias response
   */
  alias(userId, aliasId) {
    return this.client.alias(userId, aliasId);
  }
  /**
   * Get the current anonymous or known user ID
   * @returns The distinct ID of the current user
   */
  getDistinctId() {
    return this.client.getDistinctId();
  }
  /**
   * Reset the current user to a new anonymous user
   * @returns The new distinct ID
   */
  reset() {
    return this.client.reset();
  }
  /**
   * Set properties that will be included with every event
   * @param properties Properties to include with every event
   */
  setGlobalProperties(properties) {
    this.client.setGlobalProperties(properties);
  }
};
export {
  Alytica
};
