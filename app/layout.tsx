import type { Metadata } from "next";
import { Geist, Geist_Mono, Kanit } from "next/font/google";
import Navbar from "./components/Navbar";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Seminar Check-in System",
  description: "ระบบการจัดการลงทะเบียนและลงทะเบียนสัมมนา",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${kanit.variable} antialiased`}
        style={{
          fontFamily:
            "var(--font-kanit), system-ui, -apple-system, 'Segoe UI', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif",
        }}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}
