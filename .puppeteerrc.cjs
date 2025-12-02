// .puppeteerrc.cjs
// ป้องกันไม่ให้ Puppeteer ดาวน์โหลด Chrome อัตโนมัติเมื่อรัน npm install
// (จะใช้ binary ที่ระบุใน PUPPETEER_EXECUTABLE_PATH หรือ system Chromium แทน)
const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
