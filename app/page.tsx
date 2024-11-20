"use client";

import { DocumentViewerModal } from "@/components/document-viewer-modal";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function TestViewer() {
  const [isOpen, setIsOpen] = useState(false);

  const onClose = () => setIsOpen(false);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Document Viewer Test</h1>
      <Button onClick={() => setIsOpen(true)}>Open Document Viewer</Button>

      <DocumentViewerModal
        isOpen={isOpen}
        onClose={onClose}
        fileUrl="https://conasems-ava-prod.s3.sa-east-1.amazonaws.com/aulas/ava/dummy-1641923583.pdf"
      />
    </div>
  );
}
