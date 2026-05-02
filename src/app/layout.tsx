import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "Design Hub",
    template: "%s · Design Hub",
  },
  description: "Bridge ideas to shipping. A design-thinking workflow for non-tech ideators and tech builders.",
  icons: {
    // Inline SVG favicon — no extra binary asset needed.
    icon: [
      {
        url:
          "data:image/svg+xml;utf8," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="0.6" stop-color="#8b5cf6"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><rect width="32" height="32" rx="7" fill="url(#g)"/><text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="800" fill="white">DH</text></svg>`
          ),
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
