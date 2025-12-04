import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(req: NextRequest) {
	// ตัวอย่างข้อมูล namecards
	const namecards = [
		{ name: 'John Doe', company: 'ABC Corp', position: 'Manager' },
		{ name: 'Jane Smith', company: 'XYZ Inc', position: 'Developer' },
	];

	// สร้าง PDF ด้วย pdf-lib
	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

	namecards.forEach((card, idx) => {
		const page = pdfDoc.addPage([300, 150]);
		page.drawText(`Name: ${card.name}`, {
			x: 20,
			y: 120,
			size: 16,
			font,
			color: rgb(0, 0, 0),
		});
		page.drawText(`Company: ${card.company}`, {
			x: 20,
			y: 90,
			size: 12,
			font,
			color: rgb(0, 0, 0),
		});
		page.drawText(`Position: ${card.position}`, {
			x: 20,
			y: 70,
			size: 12,
			font,
			color: rgb(0, 0, 0),
		});
	});

	const pdfBytes = await pdfDoc.save();
	return new NextResponse(Buffer.from(pdfBytes), {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'attachment; filename="namecards.pdf"',
		},
	});
}
// ...existing code...
