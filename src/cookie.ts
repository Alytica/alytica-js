export const cookieManager = {
  // Cache for non-public subdomain
  _nonPublicSubDomain: "",

  /**
   * Reset the subdomain cache (useful for testing)
   */
  resetSubDomainCache(): void {
    this._nonPublicSubDomain = "";
  },

  /**
   * Find the first valid domain level that accepts cookies
   * Inspired by PostHog's implementation
   */
  seekFirstNonPublicSubDomain(hostname: string): string {
    // Return cached value if available
    if (this._nonPublicSubDomain) {
      return this._nonPublicSubDomain;
    }

    // Handle special cases
    if (
      ["localhost", "127.0.0.1"].includes(hostname) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return "";
    }

    const parts = hostname.split(".");
    const maxLevels = Math.min(parts.length, 8); // Safety limit
    const testKey = "dmn_test_" + crypto.randomUUID();
    const testRegex = new RegExp("(^|;)\\s*" + testKey + "=1");

    // Try setting cookies at different domain levels
    for (let i = 1; i <= maxLevels; i++) {
      const candidate = parts.slice(-i).join(".");
      const testCookie = `${testKey}=1;domain=.${candidate}`;

      // Try to set test cookie
      document.cookie = testCookie;

      // Check if cookie was accepted
      if (testRegex.test(document.cookie)) {
        // Cookie was accepted - clean up and return
        document.cookie = `${testKey}=1;domain=.${candidate};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        this._nonPublicSubDomain = candidate;
        return candidate;
      }
    }

    return "";
  },

  /**
   * Set a cookie with proper domain detection
   */
  set(name: string, value: any, days: number = 365): void {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    const encodedValue = encodeURIComponent(JSON.stringify(value));

    // Get hostname and find valid domain
    const hostname = window.location.hostname;
    const validDomain = this.seekFirstNonPublicSubDomain(hostname);

    // Build cookie string
    let cookieString = `${name}=${encodedValue};${expires};path=/;SameSite=Lax`;

    // Add domain only if we found a valid one
    if (validDomain) {
      cookieString += `;domain=.${validDomain}`;
    }

    // Add Secure attribute
    if (window.location.protocol === "https:") {
      cookieString += ";Secure";
    }

    // Check cookie size
    if (cookieString.length > 4093 * 0.9) {
      console.warn(
        "cookieStore warning: large cookie, len=" + cookieString.length
      );
      return;
    }

    // Set the cookie
    document.cookie = cookieString;

    // Verify setting worked
    setTimeout(() => {
      const checkCookie = this.get(name);
      if (checkCookie === null) {
        console.warn(
          `Cookie '${name}' could not be set properly on domain '${
            validDomain || hostname
          }'`
        );
      }
    }, 100);
  },

  /**
   * Get a cookie value
   */
  get(name: string): any | null {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(";");

    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        const encodedValue = cookie.substring(nameEQ.length);
        try {
          const decodedValue = decodeURIComponent(encodedValue);
          return JSON.parse(decodedValue);
        } catch (e) {
          console.error(`Error parsing cookie ${name}:`, e);
          return null;
        }
      }
    }
    return null;
  },

  /**
   * Delete a cookie
   */
  delete(name: string): void {
    const hostname = window.location.hostname;
    const validDomain = this.seekFirstNonPublicSubDomain(hostname);

    // Delete without domain specification
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;

    // Delete with domain specification if applicable
    if (validDomain) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${validDomain}`;
    }
  },

  /**
   * Generate a unique ID
   */
  generateId(): string {
    return crypto.randomUUID();
  },
};
