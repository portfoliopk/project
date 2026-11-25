import "./globals.css";

export const metadata = {
  title: "Live — Voice Translator",
  description: "Live voice translation into Urdu with automatic spoken-language detection.",
  manifest: "/manifest.webmanifest",
  applicationName: "Live",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Live"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#102b27"
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
