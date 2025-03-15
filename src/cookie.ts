export const cookieManager = {
  set(name: string, value: any, days: number = 365): void {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
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
