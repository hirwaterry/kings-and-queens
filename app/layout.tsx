import type { Metadata } from "next";
import { Inter, Cinzel, UnifrakturMaguntia } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const cinzel = Cinzel({ 
  subsets: ["latin"],
  variable: "--font-cinzel",
});

const unifraktur = UnifrakturMaguntia({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-unifraktur",
});

export const metadata: Metadata = {
  title: "Friend of a Week - Royal Pairing System",
  description: "Connect with royalty every week through our magical pairing ceremony",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${cinzel.variable} ${unifraktur.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}



