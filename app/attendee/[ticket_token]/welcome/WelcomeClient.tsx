"use client";

import { useRouter, useParams } from "next/navigation";
import "../attendee.css";

export default function AttendeeWelcomePage() {
	const router = useRouter();
	const params = useParams();
	const ticketToken = params?.ticket_token as string | undefined;

	const handleBack = () => {
		if (ticketToken) {
			router.push(`/attendee/${encodeURIComponent(ticketToken)}`);
		} else {
			router.push("/");
		}
	};

	return (
		<main className="attendee-page-container">
			<header className="attendee-page-header">
				<h1>ลงทะเบียนเรียบร้อยแล้ว</h1>
				<p>ยินดีต้อนรับสู่การสัมมนา</p>
			</header>

			<div className="attendee-page-main">
				<section className="attendee-card">
					<div className="attendee-card-header">
						<div className="attendee-avatar">🎉</div>
						<div className="attendee-info">
							<h2>ขอบคุณที่ลงทะเบียน</h2>
							<p>กรุณาเก็บบัตรชื่อและปฏิบัติตามคำแนะนำของเจ้าหน้าที่</p>
						</div>
					</div>
					<div className="attendee-details">
						<p>
							ตอนนี้ระบบได้บันทึกการเข้าร่วมของคุณเรียบร้อยแล้ว
							หากมีข้อสงสัยสามารถสอบถามเจ้าหน้าที่ที่หน้างานได้ทันที
						</p>
					</div>
				</section>

				<section className="form-section">
					<div>
						<h3>ขั้นตอนถัดไป</h3>
						<ul className="attendee-help-list">
							<li>1) เตรียมบัตรชื่อหรือ QR Code ให้เจ้าหน้าที่ตรวจสอบ</li>
							<li>2) ติดตามประกาศ หรือคำชี้แจงจากพิธีกรบนเวที</li>
							<li>3) หากมีคำถาม สามารถสอบถามที่โต๊ะลงทะเบียนได้ตลอดเวลา</li>
						</ul>
					</div>
				</section>

				<section className="form-section">
					<button type="button" className="btn btn-primary" onClick={handleBack}>
						กลับไปหน้าข้อมูลผู้เข้าร่วม
					</button>
				</section>
			</div>
		</main>
	);
}



