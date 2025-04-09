export const cookieManager = {
  set(name: string, value: any, days: number = 365): void {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    const encodedValue = encodeURIComponent(JSON.stringify(value));

    // Extract the main domain
    const domainParts = window.location.hostname.split(".");
    // Ensure there are at least two parts (e.g., 'alytica.tech')
    if (domainParts.length >= 2) {
      const domain = "." + domainParts.slice(-2).join("."); // Add the leading dot
      const cookieString = `${name}=${encodedValue};${expires};path=/;domain=${domain};SameSite=Lax`;

      if (cookieString.length > 4093 * 0.9) {
        console.warn(
          "cookieStore warning: large cookie, len=" + cookieString.length
        );
        return;
      }

      document.cookie = cookieString;
    } else {
      console.warn("Could not determine the main domain.");
      // Optionally, set the cookie for the current hostname only
      const cookieString = `${name}=${encodedValue};${expires};path=/;domain=${window.location.hostname};SameSite=Lax`;
      document.cookie = cookieString;
    }
  },

  get(name: string): any | null {
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

  generateId(): string {
    return crypto.randomUUID();
  },
};
