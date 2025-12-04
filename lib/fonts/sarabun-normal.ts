/*
  Converted from Sarabun-Regular.ttf using jsPDF Font Converter
  Font: Sarabun Regular
  This file contains the base64-encoded font data for use with jsPDF
*/

export function setupSarabunFont(doc: any) {
  // This will be populated with the base64 font data
  const fontData = {
    name: 'Sarabun',
    style: 'normal',
    weight: 'normal',
    data: 'AAEAAAALAIAAAwSwRZZEH0/3bPBjY2RmroDmzgAADiQAAACYAAAADT1MvMgoNFP0AAAHoAAAAYGNtYXCMXZYWAAABwAAAAHRnYXNwAAIAJQAADgQAAAAIdmhlYQjVBkIAAADcAAAANGhoZWEIUgTgAAAArAAAACRobXR4HZ0BgAAAAbgAAAA0bWF4cABZAJcAAAD8AAAABm5hbWVCpXz0AAABKAAAAWNwb3N0/21ADQAAASgAAAGEcHJlcHJXVJkAAANgAAAA0AACAAAAAG5ldWY1KAAA',
  };
  
  // Add the font to jsPDF's VFS (Virtual File System)
  const docWithFonts = doc as any;
  if (docWithFonts.internal && docWithFonts.internal.vfs) {
    docWithFonts.internal.vfs['Sarabun-normal.ttf'] = fontData.data;
    doc.addFont('Sarabun-normal.ttf', 'Sarabun', 'normal');
  }
}
