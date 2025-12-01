declare module 'puppeteer' {
  const p: any;
  export = p;
}

declare module '@sparticuz/chromium' {
  export const args: string[];
  export const headless: boolean;
  export function executablePath(): Promise<string>;
  const chromium: { args: string[]; headless: boolean; executablePath: () => Promise<string> };
  export default chromium;
}

