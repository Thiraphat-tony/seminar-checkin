const fs = require('fs');
const path = require('path');

// อ่านไฟล์ .ttf และแปลงเป็น base64
const fontPath = path.join(__dirname, '..', 'lib', 'fonts', 'Sarabun-Regular.ttf');
const outputPath = path.join(__dirname, '..', 'lib', 'fonts', 'Sarabun-normal.js');

try {
  const fontBuffer = fs.readFileSync(fontPath);
  const base64Font = fontBuffer.toString('base64');
  
  // สร้างไฟล์ JavaScript ที่ jsPDF สามารถใช้งานได้
  const jsContent = `// Sarabun font for jsPDF
// Converted from Sarabun-Regular.ttf
export const SarabunFont = '${base64Font}';
`;

  fs.writeFileSync(outputPath, jsContent, 'utf8');
  console.log('✅ แปลงฟอนต์สำเร็จ! ไฟล์ถูกบันทึกที่:', outputPath);
  console.log('📦 ขนาดไฟล์:', (fs.statSync(outputPath).size / 1024).toFixed(2), 'KB');
} catch (error) {
  console.error('❌ เกิดข้อผิดพลาดในการแปลงฟอนต์:', error.message);
  process.exit(1);
}
