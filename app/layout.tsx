import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
title: "AL NAIL AI",
description: "Trợ lý AI tư vấn màu sắc và thiết kế nail"
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
