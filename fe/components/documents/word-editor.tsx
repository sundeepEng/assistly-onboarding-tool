"use client";

import React, { useEffect, useRef, useState } from "react";

import Loader from "../../commonComponents/loader";

function ClientDocxEditor({
  documentBuffer,
  editorRef,
}: {
  documentBuffer: ArrayBuffer;
  editorRef: React.MutableRefObject<any>;
}) {
  const [EditorComponent, setEditorComponent] = useState<any>(null);

  useEffect(() => {
    import("@eigenpal/docx-js-editor").then((mod) => {
      setEditorComponent(() => (mod as any).DocxEditor);
    });
  }, []);

  if (!EditorComponent) {
    return <Loader fullScreen={false} message="Loading editor component..." />;
  }

  return (
    <EditorComponent
      ref={editorRef}
      documentBuffer={documentBuffer}
      mode="editing"
      onChange={() => {}}
    />
  );
}

interface WordEditorProps {
  documentEntPresignedUrl: string;
  onSave?: (updatedDocxBlob: Blob) => Promise<void> | void;
}

export default function WordEditor({
  documentEntPresignedUrl,
  onSave,
}: WordEditorProps) {
  const editorRef = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(
    null,
  );

  const lastLoadedUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!documentEntPresignedUrl) return;
    if (lastLoadedUrlRef.current === documentEntPresignedUrl) return;

    lastLoadedUrlRef.current = documentEntPresignedUrl;

    loadDocument(documentEntPresignedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentEntPresignedUrl]);

  const loadDocument = async (urlToLoad: string) => {
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      setIsLoadingDoc(true);
      setLoadError(null);
      setDocumentBuffer(null);

      const response = await fetch(urlToLoad, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch document from presigned URL (${response.status} ${response.statusText})`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();

      if (abortController.signal.aborted) return;

      setDocumentBuffer(arrayBuffer);
    } catch (error) {
      if ((error as any)?.name === "AbortError") return;
      // eslint-disable-next-line no-console
      console.error("Error loading document:", error);
      setLoadError(
        error instanceof Error ? error.message : "Error loading document",
      );
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const editor = editorRef.current;

      if (!editor) {
        // eslint-disable-next-line no-console
        console.error("[WordEditor-DocxEditor] editor ref not available");
        return;
      }

      const docxArrayBuffer = await editor.save();

      if (!docxArrayBuffer) {
        // eslint-disable-next-line no-console
        console.error("[WordEditor-DocxEditor] save returned null");
        return;
      }

      const updatedDocumentBlob = new Blob([docxArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      await onSave?.(updatedDocumentBlob);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error saving updated document:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full bg-white border rounded-lg relative min-h-[750px] overflow-x-hidden">
      {isLoadingDoc ? (
        <div className="absolute inset-0 z-10 bg-white">
          <Loader fullScreen={false} message="Loading document..." />
        </div>
      ) : null}

      {loadError ? (
        <div className="px-4 py-2 text-sm text-red-600 border-b">
          {loadError}
        </div>
      ) : null}

      <div className="flex justify-end p-3 border-b">
        <button
          onClick={handleSave}
          disabled={isSaving || isLoadingDoc || !documentBuffer}
          className="px-4 py-2 rounded-md bg-[#3089ab] text-white"
          type="button"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {documentBuffer ? (
        <div style={{ height: "750px" }} className="w-full overflow-x-hidden">
          <ClientDocxEditor
            documentBuffer={documentBuffer}
            editorRef={editorRef}
          />
        </div>
      ) : null}
    </div>
  );
}
