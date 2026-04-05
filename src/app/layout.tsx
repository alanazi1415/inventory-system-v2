import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const font = IBM_Plex_Sans_Arabic({ weight: ["300", "400", "500", "600", "700"], subsets: ["arabic"], variable: "--font-arabic" });

export const metadata: Metadata = {
  title: "نظام دراسة المخزون - هوز وموصول",
  description: "لوحة تحكم ذكية لدراسة وتحليل مخزون هوز وموصول",
  authors: [{ name: "عايد حمود العنزي" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${font.variable} font-sans antialiased bg-background text-foreground`}>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>
          <footer className="py-3 px-6 text-center text-sm text-muted-foreground bg-muted/50 border-t w-full">
            <p>الحقوق محفوظة وإعداد عبدالله فرحان العنزي - موظف نوبكو</p>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
