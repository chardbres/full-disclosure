import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Turns relative links in metadata, like canonical URLs, into full ones
  metadataBase: new URL("https://fulldisclosure.rickbresnahan.com"),
  title: {
    default: "Full Disclosure: SEC filings, summarized",
    template: "%s · Full Disclosure",
  },
  description:
    "Plain-English summaries of 10-K, 10-Q and 8-K filings from SEC EDGAR: what changed, the key risks and the tone for investors.",
};

const RootLayout = ({ children }: LayoutProps<"/">) => {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
};

export default RootLayout;
