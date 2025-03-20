import { onCLS, onFCP, onINP, onLCP } from "web-vitals";
import { TrackingClient } from "./tracking";
import { WebTrackingClientConfig } from "./types";

function toCamelCase(str: string): string {
  return str.replace(/([-_][a-z])/gi, (match) =>
    match.toUpperCase().replace("-", "").replace("_", "")
  );
}

export class WebTrackingClient extends TrackingClient {
  protected override options: WebTrackingClientConfig; // Change private to protected to match base class
  private lastPath: string = "";
  private debounceTimer: number | undefined;

  constructor(options: WebTrackingClientConfig) {
    super({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      debug: options.debug,
      disabled: options.disabled,
      waitForProfile: options.waitForProfile,
      processProfiles: options.processProfiles,
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
        $title: document.title,
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
    }
  }

  private debounce(func: () => void, delay: number): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(func, delay);
  }

  private trackWebVitals(): void {
    onCLS((metric) => {
      this.track("$web_vitals", {
        $metric_name: "CLS",
        $metric_value: metric.value,
        $metric_rating: metric.rating,
        $metric_delta: metric.delta,
      });
    });

    onLCP((metric) => {
      this.track("$web_vitals", {
        $metric_name: "LCP",
        $metric_value: metric.value,
        $metric_rating: metric.rating,
        $metric_delta: metric.delta,
      });
    });
    onFCP((metric) => {
      this.track("$web_vitals", {
        $metric_name: "FCP",
        $metric_value: metric.value,
        $metric_rating: metric.rating,
        $metric_delta: metric.delta,
      });
    });
    onINP((metric) => {
      this.track("$web_vitals", {
        $metric_name: "INP",
        $metric_value: metric.value,
        $metric_rating: metric.rating,
        $metric_delta: metric.delta,
      });
    });
  }

  private trackOutgoingLinks(): void {
    if (this.isServer()) {
      return;
    }

    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a") as HTMLAnchorElement;

      if (link && target) {
        const href = link.getAttribute("href");
        if (href?.startsWith("http")) {
          super.track("$linkOut", {
            href: href,
            text:
              link.innerText ||
              link.getAttribute("title") ||
              target.getAttribute("alt") ||
              target.getAttribute("title"),
          });
        }
      }
    });
  }

  private trackPageViews(): void {
    if (this.isServer()) {
      return;
    }

    const originalPushState = history.pushState;
    // Fix the arguments typing issue by specifying correct signature
    history.pushState = function (
      data: any,
      unused: string,
      url?: string | URL
    ) {
      const result = originalPushState.call(this, data, unused, url);
      window.dispatchEvent(new Event("pushstate"));
      window.dispatchEvent(new Event("locationchange"));
      return result;
    };

    const originalReplaceState = history.replaceState;
    // Fix the arguments typing issue by specifying correct signature
    history.replaceState = function (
      data: any,
      unused: string,
      url?: string | URL
    ) {
      const result = originalReplaceState.call(this, data, unused, url);
      window.dispatchEvent(new Event("replacestate"));
      window.dispatchEvent(new Event("locationchange"));
      return result;
    };

    window.addEventListener("popstate", () => {
      window.dispatchEvent(new Event("locationchange"));
    });

    const handleLocationChange = () =>
      this.debounce(() => this.pageView(), 200);

    if (this.options.trackHashChanges) {
      window.addEventListener("hashchange", handleLocationChange);
    } else {
      window.addEventListener("locationchange", handleLocationChange);
    }
  }

  private trackAttributes(): void {
    if (this.isServer()) {
      return;
    }

    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest("button") as HTMLButtonElement;
      const link = target.closest("a") as HTMLAnchorElement;

      const trackElement = button?.getAttribute("data-track")
        ? button
        : link?.getAttribute("data-track")
          ? link
          : null;

      if (trackElement) {
        const properties: Record<string, any> = {};

        for (const attr of trackElement.attributes) {
          if (attr.name.startsWith("data-") && attr.name !== "data-track") {
            properties[toCamelCase(attr.name.replace(/^data-/, ""))] =
              attr.value;
          }
        }

        const eventName = trackElement.getAttribute("data-track");
        if (eventName) {
          super.track(eventName, properties);
        }
      }
    });
  }

  pageView(
    path?: string | Record<string, any>,
    properties?: Record<string, any>
  ): void {
    if (this.isServer()) {
      return;
    }

    let currentPath: string | undefined;
    let currentProperties: Record<string, any> | undefined;

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
        ...(currentProperties ?? {}),
      });
    }
  }
}
