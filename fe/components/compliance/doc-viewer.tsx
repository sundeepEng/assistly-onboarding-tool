"use client";

import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../commonComponents/card";

const PptViewer = ({ pptUrl }: { pptUrl: string }) => {
  const googleDocsViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    pptUrl
  )}&embedded=true`;

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <iframe
        src={googleDocsViewerUrl}
        style={{ width: "100%", height: "100%" }}
        frameBorder="0"
      />
    </div>
  );
};

export default PptViewer;

// Props for each document
interface DocumentCardProps {
  title: string;
  s3Url: string;
  documentExpiryDate?: string;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ title, s3Url, documentExpiryDate }) => {
  if (!s3Url) return null;
  
  // Check if certificate is expired
  const isExpired = documentExpiryDate ? (() => {
    const dateOnly = documentExpiryDate.split("T")[0];
    const [year, month, day] = dateOnly.split("-").map(Number);
    const expiry = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > expiry;
  })() : false;

  // Memoize the Google Docs viewer URL so the iframe doesn't reload on every render
  // This prevents multiple download prompts from being triggered
  const iframeUrl = useMemo(() => {
    return `https://docs.google.com/gview?url=${encodeURIComponent(
      s3Url
    )}&embedded=true`;
  }, [s3Url]);

  return (
    <Card className="max-w-sm mx-auto my-4 shadow-lg border rounded-md overflow-hidden">
      <CardHeader className="bg-gray-100">
        <CardTitle className="text-lg font-semibold">
          {title}
          {isExpired && <span className="text-red-600 ml-2">- Expired</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="relative aspect-video w-full border rounded-md overflow-hidden">
          <iframe
            src={iframeUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            title={title}
            loading="lazy"
          />
        </div>
      </CardContent>
    </Card>
  );
};
