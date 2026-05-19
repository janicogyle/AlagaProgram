import { Geist } from "next/font/google";
import "./globals.css";
import CookieConsentBanner from "@/components/CookieConsentBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Barangay Sta. Rita - Digital Identification System",
  description: "Digital ID System for Barangay Sta. Rita residents - manage PWD, Senior Citizens, and Solo Parents",
  icons: {
    icon: "/Brand.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={geistSans.variable}>
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
