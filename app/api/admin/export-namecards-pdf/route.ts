import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

export async function GET(req: NextRequest) {
	// ตัวอย่างข้อมูล namecards
	const namecards = [
		{ name: 'John Doe', company: 'ABC Corp', position: 'Manager' },
		{ name: 'Jane Smith', company: 'XYZ Inc', position: 'Developer' },
	];

	// สร้าง PDF
	const doc = new jsPDF();
	namecards.forEach((card, idx) => {
		doc.text(`Name: ${card.name}`, 10, 10 + idx * 30);
		doc.text(`Company: ${card.company}`, 10, 20 + idx * 30);
		doc.text(`Position: ${card.position}`, 10, 30 + idx * 30);
		if (idx < namecards.length - 1) doc.addPage();
	});

	// ส่ง PDF กลับเป็น response
	const pdfData = doc.output('arraybuffer');
	return new NextResponse(Buffer.from(pdfData), {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'attachment; filename="namecards.pdf"',
		},
	});
}
