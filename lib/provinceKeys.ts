export const PROVINCE_KEY_MAP: Record<string, string> = {
  'กรุงเทพมหานคร': 'BBK',
  'กระบี่': 'KRB',
  'กาญจนบุรี': 'KRI',
  'กาฬสินธุ์': 'KSN',
  'กำแพงเพชร': 'KPP',
  'ขอนแก่น': 'KKC',
  'จันทบุรี': 'CTB',
  'ฉะเชิงเทรา': 'CCS',
  'ชลบุรี': 'CBI',
  'ชัยนาท': 'CNT',
  'ชัยภูมิ': 'CYP',
  'ชุมพร': 'CPN',
  'เชียงราย': 'CRI',
  'เชียงใหม่': 'CMI',
  'ตรัง': 'TRG',
  'ตราด': 'TRT',
  'ตาก': 'TAK',
  'นครนายก': 'NYK',
  'นครปฐม': 'NPT',
  'นครพนม': 'NPM',
  'นครราชสีมา': 'NRM',
  'นครศรีธรรมราช': 'NST',
  'นครสวรรค์': 'NSN',
  'นนทบุรี': 'NBI',
  'นราธิวาส': 'NWT',
  'น่าน': 'NAN',
  'บึงกาฬ': 'BKN',
  'บุรีรัมย์': 'BRM',
  'ปทุมธานี': 'PTT',
  'ประจวบคีรีขันธ์': 'PKK',
  'ปราจีนบุรี': 'PCB',
  'ปัตตานี': 'PTN',
  'พระนครศรีอยุธยา': 'AYT',
  'พะเยา': 'PYO',
  'พังงา': 'PNG',
  'พัทลุง': 'PTL',
  'พิจิตร': 'PCT',
  'พิษณุโลก': 'PLO',
  'เพชรบุรี': 'PBR',
  'เพชรบูรณ์': 'PBN',
  'แพร่': 'PRE',
  'ภูเก็ต': 'PKT',
  'มหาสารคาม': 'MSK',
  'มุกดาหาร': 'MDA',
  'แม่ฮ่องสอน': 'MHS',
  'ยะลา': 'YLA',
  'ยโสธร': 'YSN',
  'ร้อยเอ็ด': 'RET',
  'ระนอง': 'RNG',
  'ระยอง': 'RYG',
  'ราชบุรี': 'RBR',
  'ลพบุรี': 'LBR',
  'ลำปาง': 'LPG',
  'ลำพูน': 'LPN',
  'เลย': 'LOE',
  'ศรีสะเกษ': 'SSK',
  'สกลนคร': 'SKN',
  'สงขลา': 'SKA',
  'สตูล': 'STN',
  'สมุทรปราการ': 'SPK',
  'สมุทรสงคราม': 'SSG',
  'สมุทรสาคร': 'SAK',
  'สระแก้ว': 'SKE',
  'สระบุรี': 'SRB',
  'สิงห์บุรี': 'SBR',
  'สุโขทัย': 'SKT',
  'สุพรรณบุรี': 'SPB',
  'สุราษฎร์ธานี': 'SRT',
  'สุรินทร์': 'SRN',
  'หนองคาย': 'NKI',
  'หนองบัวลำภู': 'NBL',
  'อ่างทอง': 'ATG',
  'อุดรธานี': 'UDN',
  'อุทัยธานี': 'UTI',
  'อุตรดิตถ์': 'UTD',
  'อุบลราชธานี': 'UBR',
  'อำนาจเจริญ': 'AMN',
};

export function makeProvinceKey(provinceName: string) {
  const key = PROVINCE_KEY_MAP[provinceName.trim()];
  return key ?? encodeURIComponent(provinceName.trim());
}

export function getProvinceNameFromKey(key: string) {
  const normalized = (key || '').trim().toUpperCase();

  for (const [name, code] of Object.entries(PROVINCE_KEY_MAP)) {
    if (code.toUpperCase() === normalized) return name;
    // also check encoded form (makeProvinceKey falls back to encodeURIComponent)
    if (encodeURIComponent(name).toLowerCase() === key.trim().toLowerCase()) return name;
  }

  return undefined;
}
