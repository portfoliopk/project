import "./globals.css";
export const metadata={title:"Pashto ↔ Urdu Live Translator",description:"Two-way Pashto and Urdu live voice translator with offline-ready PWA support.",manifest:"/manifest.webmanifest",applicationName:"Pashto Urdu Translator",appleWebApp:{capable:true,statusBarStyle:"default",title:"Pashto Urdu"}};
export const viewport={width:"device-width",initialScale:1,maximumScale:1,themeColor:"#102b27"};
export default function RootLayout({children}){return <html lang="en"><body>{children}</body></html>;}
