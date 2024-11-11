import "~/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { TRPCReactProvider } from "~/trpc/react";
import { Header } from "./_components/header";
import { Providers } from './providers';

export const metadata: Metadata = {
  title: "Visual Audio Books",
  description: "Listen to audio books with interesting images to go along with the story",
  icons: [{ rel: "icon", url: "/image.png" }],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable}`}>
      <body className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] font-sans antialiased">
        <Providers>
          <TRPCReactProvider>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              <div className="flex-1">
                {children}
              </div>
            </div>
          </TRPCReactProvider>
        </Providers>
      </body>
    </html>
  );
}
