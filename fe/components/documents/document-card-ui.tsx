"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Edit as FiEdit,
  Eye as FiEye,
  Trash as FiTrash,
  Upload as FiUpload,
} from "lucide-react";
import useUpdate from "../../services/update";
import mammoth from "mammoth";

import CommonModal from "../../commonComponents/common-modal";
import Button from "../../commonComponents/button";
import Loader from "../../commonComponents/loader";
import InputFieldComponent from "../../commonComponents/input-field-component";

import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";

import { formatDate, omit } from "../../utils/dateUtils";
import {
  InHomeCare,
  USER_PATH_OMIT_FIELDS,
  UserPath,
  userRoles,
  onboardingDocsForSeniors,
  onboardingDocsForPCG,
  milestones,
  inHomeCareOnboardingDocsForSeniors,
} from "../../utils/constants";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../utils/auth";

import useGetById from "../../services/getById";
import fetchPreSignedUrl from "../../services/get-presigned-url";
import { fetchDocusealBuilderToken } from "../../services/docuseal-builder-token";

import { useGetHomeType } from "../../utils/gethomeType";

import { CheckValidityOfDocument } from "../../utils/checkValidityOfDocument";

import DocxEditorModal from "./docx-editor-modal";
import DocusealBuilderModal from "./docuseal-builder-modal";
import { ViewOptionModal } from "./view-option-modal";

import InfoIcon from "../../public/icons/info-circle-icon";

export type DocumentItem = {
  documentId: string;
  documentName: string;
  status: "Uploaded" | "Missing";
  file?: File;
  createdByUserId?: any;
  createdAt?: string;
  required?: boolean;
  documentType?: string;
  documentUrl?: string;
  documentLabel?: string;
  isRequiredDocument?: boolean;
  documentCategory?: string;
  alertPeriodInDays?: number;
  documentTemplateId?: any;
  version?: number;
  documentExpiryDate?: string;
  documentExpiryDateRequired?: boolean;
  signedDocumentUrl?: { url: string; createdAt: string }[];
};

export type DocumentCardProps = {
  document: DocumentItem;
  handleFileChange?: (
    document: any,
    e: React.ChangeEvent<HTMLInputElement>,
    documentExpiryDateRequired?: string,
  ) => void;
  onDelete?: (document: any) => void;
  onUploadComplete?: (
    uploadedFiles: {
      fileUrl: string;
      documentType: string;
      documentName: string;
      documentCategory?: string;
      isRequiredDocument?: boolean;
    }[],
  ) => void;
  onPatchedDocument?: (args: {
    documentId?: string;
    documentName?: string;
    documentUrl: string;
    documentType?: string;
  }) => void;
  leadData?: any;
  index?: number;
  deleted?: boolean;
};

export const DocumentCardUi: React.FC<DocumentCardProps> = ({
  document,
  handleFileChange,
  onDelete,
  onUploadComplete,
  onPatchedDocument,
  leadData,
  index,
  deleted,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dispatch = useAppDispatch();
  const homeId = getHomeIdFromToken();

  const { mutateAsync: updateMutateAsync } = useUpdate();

  const [effectiveTemplateId, setEffectiveTemplateId] = useState<
    number | undefined
  >(
    (document as any)?.documentTemplateId
      ? Number((document as any).documentTemplateId)
      : undefined,
  );
  const [effectiveDocumentUrl, setEffectiveDocumentUrl] = useState<string>(
    String((document as any)?.documentUrl || ""),
  );
  const [docusealDraftKey, setDocusealDraftKey] = useState<number>(Date.now());

  useEffect(() => {
    setEffectiveDocumentUrl(String((document as any)?.documentUrl || ""));
  }, [(document as any)?.documentUrl]);

  useEffect(() => {
    setEffectiveTemplateId(
      (document as any)?.documentTemplateId
        ? Number((document as any).documentTemplateId)
        : undefined,
    );
  }, [(document as any)?.documentTemplateId]);

  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [expirationDate, setExpirationDate] = useState<string | undefined>();

  const handleModalFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setSelectedFile(event);
  };

  const handleMissingUploadClick = () => {
    setShowExpirationModal(true);
    // if ((document as any)?.documentExpiryDateRequired) {
    //   setShowExpirationModal(true);
    //   return;
    // }
    // fileInputRef.current?.click();
  };

  const { data } = useGetById({
    key: "userId",
    payload: {
      id: (document as any).createdByUserId,
      path: UserPath,
      enabled: !!(document as any).createdByUserId,
    },
  });

  const isDeleteDisabled =
    ((leadData as any)?.docusignEnvelopeStatus === "completed" ||
      (leadData as any)?.onboardingESignEnvelopeStatus === "completed") &&
    document?.documentCategory === "onboarding";

  // Disable edit/delete if lead is deleted or has lost milestone
  const isDeletedOrLost =
    leadData?.isDeleted || leadData?.milestone?.includes(milestones.LOST);

  const openWordDocumentInViewer = async (
    viewerWindow: Window,
    presignedUrl: string,
    fileName: string,
  ) => {
    try {
      const response = await fetch(presignedUrl);
      if (!response.ok)
        throw new Error(
          `Failed to fetch document (${response.status} ${response.statusText})`,
        );
      const arrayBuffer = await response.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const htmlContent = result.value;

      const viewerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #525659; height: 100vh; display: flex; flex-direction: column; }
    .toolbar { background: #323639; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; height: 48px; flex-shrink: 0; border-bottom: 1px solid #1a1a1a; }
    .toolbar-left { display: flex; align-items: center; gap: 12px; }
    .toolbar-title { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px; }
    .toolbar-right { display: flex; align-items: center; gap: 8px; }
    .toolbar-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; transition: background 0.15s; }
    .toolbar-btn:hover { background: rgba(255,255,255,0.1); }
    .toolbar-btn svg { width: 16px; height: 16px; }
    .content-wrapper { flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 24px 16px; }
    .document-page { background: #fff; width: 100%; max-width: 816px; min-height: 1056px; padding: 72px 72px 96px 72px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); border-radius: 2px; margin-bottom: 24px; }
    .document-page * { background-color: inherit; }
    .document-page section { background: #fff; }
    .document-page br[style], .document-page br[data-page-break-before] { display: block; page-break-before: always; margin: 0; padding: 0; }
    .document-page img { max-width: 100%; height: auto; }
    .document-page table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    .document-page table td, .document-page table th { border: 1px solid #d0d0d0; padding: 8px 12px; text-align: left; font-size: 14px; }
    .document-page table th { background: #f5f5f5; font-weight: 600; }
    .document-page p { margin: 0 0 10px 0; line-height: 1.6; font-size: 14px; color: #333; }
    .document-page h1 { font-size: 24px; margin: 0 0 16px 0; color: #1a1a1a; font-weight: 700; }
    .document-page h2 { font-size: 20px; margin: 20px 0 12px 0; color: #1a1a1a; font-weight: 600; }
    .document-page h3 { font-size: 16px; margin: 16px 0 10px 0; color: #1a1a1a; font-weight: 600; }
    .document-page ul, .document-page ol { margin: 0 0 12px 24px; padding: 0; }
    .document-page li { margin: 4px 0; line-height: 1.6; font-size: 14px; color: #333; }
    .document-page strong, .document-page b { font-weight: 700; }
    .document-page a { color: #1a73e8; text-decoration: underline; }
    @media print { .toolbar { display: none; } .content-wrapper { padding: 0; background: #fff; } .document-page { box-shadow: none; padding: 48px; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="toolbar-title">${fileName}</span>
    </div>
    <div class="toolbar-right">
      <button class="toolbar-btn" onclick="window.print()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print
      </button>
      <button class="toolbar-btn" onclick="window.open('${presignedUrl}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download
      </button>
    </div>
  </div>
  <div class="content-wrapper">
    <div class="document-page">${htmlContent}</div>
  </div>
</body>
</html>`;

      viewerWindow.document.open();
      viewerWindow.document.write(viewerHtml);
      viewerWindow.document.close();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Word viewer error:", error);
      viewerWindow.document.open();
      viewerWindow.document.write(`
        <html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#525659;">
          <div style="background:#fff;padding:40px;border-radius:8px;text-align:center;max-width:420px;">
            <h2 style="margin:0 0 12px;color:#d32f2f;">Unable to load document</h2>
            <p style="color:#555;margin:0 0 20px;">The document could not be displayed. Please try downloading it instead.</p>
            <a href="${presignedUrl}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:10px 24px;border-radius:4px;font-size:14px;">Download File</a>
          </div>
        </body></html>
      `);
      viewerWindow.document.close();
    }
  };

  const handleDocxSaved = async ({
    uploadedUrl,
    documentType,
    documentName,
  }: {
    uploadedUrl: string;
    documentType: string;
    documentName: string;
  }) => {
    try {
      onUploadComplete?.([
        {
          fileUrl: uploadedUrl,
          documentType,
          documentName,
          documentCategory: "onboarding",
        },
      ]);

      onPatchedDocument?.({
        documentId: String((document as any)?.documentId || ""),
        documentName: String(document?.documentName || ""),
        documentUrl: uploadedUrl,
        documentType,
      });

      setEffectiveDocumentUrl(uploadedUrl);
      setEffectiveTemplateId(undefined);
      setDocusealDraftKey(Date.now());

      const userIdToUpdate = String(leadData?.userId || "");
      if (!userIdToUpdate) return;

      const existingDocuments = Array.isArray(leadData?.documents)
        ? leadData.documents
        : [];

      const currentDocId = String((document as any)?.documentId || "");
      const currentDocName = String(document?.documentName || "");

      const updatedDocuments = existingDocuments.map((d: any) => {
        const sameId =
          currentDocId && String(d?.documentId || "") === currentDocId;
        const sameName =
          !currentDocId &&
          currentDocName &&
          String(d?.documentName || "").toLowerCase() ===
            currentDocName.toLowerCase();

        if (!sameId && !sameName) return d;

        return {
          ...d,
          documentUrl: uploadedUrl,
          documentType,
          documentName: d?.documentName || documentName,
          documentTemplateId: null,
        };
      });

      const userDataToUpdate = {
        ...leadData,
        documents: updatedDocuments,
      };

      const cleaned = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);

      await updateMutateAsync({
        path: UserPath,
        data: {
          ...cleaned,
          userId: userIdToUpdate,
        },
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const buildDocusealToken = async () => {
    const roles = ["Resident", "PCHO"];

    const templateId = effectiveTemplateId;

    const externalIdPayload = templateId
      ? {
          userId: leadData?.userId,
          documentName: document?.documentName,
          version: (document as any)?.version,
        }
      : {
          userId: leadData?.userId,
          documentName: document?.documentName,
          version: (document as any)?.version,
          draftKey: docusealDraftKey,
        };

    let documentUrls: string[] | undefined = undefined;
    if (!templateId) {
      const src = String(effectiveDocumentUrl || "");
      if (!src) {
        throw new Error("Document URL is missing.");
      }
      const presigned = await fetchPreSignedUrl(src);
      if (!presigned)
        throw new Error("Unable to load document URL for builder.");
      documentUrls = [presigned];
    }

    return fetchDocusealBuilderToken({
      integrationEmail: leadData?.email,
      name: document?.documentName || "Template",
      documentUrls,
      templateId,
      externalId: JSON.stringify(externalIdPayload),
      roles,
    });
  };

  const persistDocumentTemplateId = async (nextTemplateId: number) => {
    const userIdToUpdate = String(leadData?.userId || "");
    if (!userIdToUpdate) return;

    const existingDocuments = Array.isArray(leadData?.documents)
      ? leadData.documents
      : [];

    const currentDocId = String((document as any)?.documentId || "");
    const currentDocName = String(document?.documentName || "");

    const updatedDocuments = existingDocuments.map((d: any) => {
      const sameId =
        currentDocId && String(d?.documentId || "") === currentDocId;
      const sameName =
        !currentDocId &&
        currentDocName &&
        String(d?.documentName || "").toLowerCase() ===
          currentDocName.toLowerCase();

      if (!sameId && !sameName) return d;

      return {
        ...d,
        documentTemplateId: nextTemplateId,
      };
    });

    const userDataToUpdate = {
      ...leadData,
      documents: updatedDocuments,
    };

    const cleaned = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);

    await updateMutateAsync({
      path: UserPath,
      data: {
        ...cleaned,
        userId: userIdToUpdate,
      },
    });
  };

  const handleBuilderSend = async (data: any) => {
    try {
      const maybeTemplateId =
        Number(data?.template_id) ||
        Number(data?.templateId) ||
        Number(data?.template?.id) ||
        Number(data?.template?.template_id);

      if (!maybeTemplateId) return;

      setEffectiveTemplateId(maybeTemplateId);
      await persistDocumentTemplateId(maybeTemplateId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const handleExpirationUpload = async () => {
    try {
      setUploading(true);

      await handleFileChange?.(document, selectedFile, expirationDate);

      setShowExpirationModal(false);
    } finally {
      setUploading(false);
    }
  };

  const handleViewOptionView = async () => {
    const viewerWindow = window.open("about:blank", "_blank");
    if (!viewerWindow) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          "Popup blocked. Please allow popups and try again.",
        ),
      );
      return;
    }
    viewerWindow.document.open();
    viewerWindow.document.write(`
            <html><head><title>Loading document...</title></head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#525659;">
              <div style="text-align:center;color:#fff;">
                <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
                <p style="font-size:15px;">Loading document...</p>
                <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
              </div>
            </body></html>
          `);
    viewerWindow.document.close();
    setViewOptionModalOpen(false);
    try {
      const url = await fetchPreSignedUrl(pendingViewUrl);
      if (url) {
        const fileName =
          document.documentName ||
          pendingViewUrl.split("/").pop() ||
          "Document";
        await openWordDocumentInViewer(viewerWindow, url, fileName);
      } else {
        viewerWindow.close();
      }
    } catch {
      viewerWindow.close();
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Unable to load File. Please try again."),
      );
    }
  };

  const handleViewOptionDownload = async () => {
    try {
      setViewOptionLoading(true);
      const url = await fetchPreSignedUrl(pendingViewUrl);
      if (url) {
        const link = window.document.createElement("a");
        link.href = url;
        link.download = document.documentName || "document";
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }
      setViewOptionModalOpen(false);
    } catch {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Unable to download File. Please try again."),
      );
    } finally {
      setViewOptionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleteLoading(true);
      await Promise.resolve(onDelete?.(document));
      setDeleteModalOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteLoading(false);
  };

  const handleViewFile = async (documentUrl: string) => {
    try {
      const isWordDocument =
        document.documentType === ".doc" || document.documentType === ".docx";

      if (isWordDocument) {
        const viewerWindow = window.open("about:blank", "_blank");
        const enabled = !!documentUrl;
        if (!enabled) return;
        if (!viewerWindow) {
          const url = await fetchPreSignedUrl(documentUrl);
          if (url) {
            window.location.href = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
          }
          return;
        }

        viewerWindow.document.open();
        viewerWindow.document.write(`
          <html><head><title>Loading document...</title></head>
          <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#525659;">
            <div style="text-align:center;color:#fff;">
              <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
              <p style="font-size:15px;">Loading document...</p>
              <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
            </div>
          </body></html>
        `);
        viewerWindow.document.close();

        const url = await fetchPreSignedUrl(documentUrl);
        if (url) {
          const fileName =
            document.documentName || documentUrl.split("/").pop() || "Document";
          await openWordDocumentInViewer(viewerWindow, url, fileName);
        } else {
          viewerWindow.close();
        }
      } else {
        const url = await fetchPreSignedUrl(documentUrl);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Unable to load File. Please try again."),
      );
    }
  };

  const handleViewClick = () => {
    const isWord =
      document.documentType === ".doc" || document.documentType === ".docx";
    if (isWord) {
      setPendingViewUrl(String(document.documentUrl || ""));
      setViewOptionModalOpen(true);
      return;
    }
    handleViewFile(String(document.documentUrl || ""));
  };

  const handleEditClick = () => {
    if (isEditDisabled || deleted || isDeletedOrLost) return;
    setIsModalOpen(true);
  };

  const handleDeleteClick = () => {
    if (deleted || isDeleteDisabled || isDeletedOrLost) return;
    setDeleteModalOpen(true);
  };

  const [urlForEditingDocs, setUrlForEditingDocs] = useState<string | null>(
    null,
  );
  const lastEditPresignSourceRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchUrl = async () => {
      const enabled = !!effectiveDocumentUrl;
      if (!enabled) return;

      const url = await fetchPreSignedUrl(effectiveDocumentUrl);
      const next = url || effectiveDocumentUrl;
      setUrlForEditingDocs((prev) => (prev === next ? prev : next));
    };

    if (isModalOpen) {
      const src = String(effectiveDocumentUrl || "");
      if (!src) return;
      if (lastEditPresignSourceRef.current === src && urlForEditingDocs) return;
      lastEditPresignSourceRef.current = src;
      fetchUrl();
    }
  }, [isModalOpen, effectiveDocumentUrl]);

  const isWordDocument = (() => {
    const t = String(document.documentType || "")
      .toLowerCase()
      .trim();
    const name = String(document.documentName || "")
      .toLowerCase()
      .trim();
    const url = String(document.documentUrl || "")
      .toLowerCase()
      .trim();

    if (t === ".doc" || t === ".docx") return true;
    if (t === "doc" || t === "docx") return true;
    if (
      t === "application/msword" ||
      t ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return true;
    }
    if (name.endsWith(".doc") || name.endsWith(".docx")) return true;
    if (url.includes(".docx") || url.includes(".doc")) return true;
    return false;
  })();

  const isEditDisabled = !isWordDocument;

  const isOnboarding = document.documentCategory === "onboarding";

  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;

  const isInOnboardingDocsForSeniors =
    leadData?.role === userRoles.SENIOR || leadData?.role === userRoles.LEAD
      ? (isInHomeCare
          ? inHomeCareOnboardingDocsForSeniors
          : onboardingDocsForSeniors
        ).includes(document.documentName || "")
      : onboardingDocsForPCG.includes(document.documentName || "");

  const isEsignEnvelopeCompleted =
    (leadData as any)?.docusignEnvelopeStatus === "completed" ||
    (leadData as any)?.onboardingESignEnvelopeStatus === "completed";
  const showEsign =
    isOnboarding &&
    (isInOnboardingDocsForSeniors ? isEsignEnvelopeCompleted : true);

  const userId = getUserIdFromToken();
  const { data: loggedInUserData } = useGetById({
    key: "loggedInUser",
    payload: {
      path: UserPath,
      id: userId || "",
      enabled: !!userId,
    },
  });

  const [builderModalOpen, setBuilderModalOpen] = useState(false);

  const documentExpiryDate = String(
    (document as any)?.documentExpiryDate ||
      (document as any)?.expiryDate ||
      "",
  );

  const expirationDetails = CheckValidityOfDocument({
    alertPeriodInDays: Number(document?.alertPeriodInDays ?? 30),
    expirationDate: documentExpiryDate,
  });

  const expirationLabel = expirationDetails
    ? String(expirationDetails?.message || "")
        .toLowerCase()
        .includes("expired")
      ? "Expired"
      : "Expiring"
    : null;

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [viewOptionModalOpen, setViewOptionModalOpen] = useState(false);
  const [viewOptionLoading, setViewOptionLoading] = useState(false);
  const [pendingViewUrl, setPendingViewUrl] = useState<string>("");

  return (
    <div className="flex flex-col justify-between bg-white border-[1px] border-solid border-[#D1D5DB] rounded-lg p-4 gap-2 hover:shadow-md transition-shadow w-[350px] max-h-[210px]">
      <div className="flex justify-between items-center">
        <div
          className="text-sm font-medium text-gray-900 truncate max-w-[330px] overflow-hidden whitespace-nowrap text-ellipsis"
          title={document.documentLabel}
        >
          {String(document?.documentLabel || "").length > 90
            ? `${String(document.documentLabel).substring(0, 45)}...`
            : document.documentLabel}
        </div>
        <div className="flex items-center gap-2">
          {document.status === "Uploaded" && expirationLabel && (
            <div
              className={`text-[12px] font-semibold px-2 py-[2px] rounded-md ${
                expirationLabel === "Expired"
                  ? "bg-red-50 text-red-600"
                  : "bg-yellow-50 text-yellow-600"
              }`}
            >
              {expirationLabel}
            </div>
          )}

          <div
            className={`${document.status === "Uploaded" ? "text-green-600" : "text-red-600"}`}
          >
            {document.status === "Uploaded" ? <CheckCircle /> : <AlertCircle />}
          </div>
        </div>
      </div>

      {/* Expired documents indication */}
      {document.status === "Uploaded" && (
        <div className="text-xs text-gray-600">
          {(document as any).createdByUserId && (
            <div>Uploaded by: {data ? (data as any)?.name : "Unknown"}</div>
          )}
          {(document as any).createdAt && (
            <div>Date: {formatDate((document as any).createdAt)}</div>
          )}
          {documentExpiryDate && (
            <div className={`${expirationDetails?.color || ""}`.trim()}>
              Expiry Date: {formatDate(documentExpiryDate)}
            </div>
          )}
          {expirationDetails && (
            <div
              className={`${expirationDetails?.color} ${expirationDetails?.border} border-l-4`}
            >
              {expirationDetails?.message}
            </div>
          )}
        </div>
      )}

      {/* Missing documents placeholders */}
      {document.status === "Missing" ? (
        <div className={`${deleted ? "cursor-not-allowed opacity-50" : ""}`}>
          <div
            className={`border-[#e2e8f0] border-2 border-dashed bg-[#F7FAFC] rounded-lg p-2 text-center mb-4 transition-colors ${
              deleted
                ? "pointer-events-none cursor-not-allowed"
                : "cursor-pointer"
            }`}
            onClick={handleMissingUploadClick}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden"
              ref={fileInputRef}
              onChange={(event) =>
                handleFileChange && handleFileChange(document, event)
              }
            />
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <FiUpload size={24} />
              <p className="text-sm">Click to upload</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div
              onClick={handleViewClick}
              className={`flex items-center justify-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg ${
                deleted
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
            >
              <FiEye /> View
            </div>

            {isOnboarding && (
              <div
                className={`${deleted || isDeletedOrLost ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div
                  title={
                    isEditDisabled
                      ? "Only Word documents (.doc/.docx) can be edited"
                      : deleted || isDeletedOrLost
                        ? "User is deleted or lost"
                        : "Edit document"
                  }
                  className={`flex items-center justify-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg transition-colors ${
                    isEditDisabled || deleted || isDeletedOrLost
                      ? "pointer-events-none cursor-not-allowed opacity-50 text-[#4B5563]"
                      : "cursor-pointer text-[#4B5563] hover:text-black"
                  }`}
                  onClick={handleEditClick}
                >
                  <FiEdit /> Edit
                </div>
              </div>
            )}

            <div
              className={`${deleted || isDeletedOrLost ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <div
                className={`flex items-center justify-center gap-2 px-3 py-2 border-[1px] border-solid rounded-lg border-[#D1D5DB] ${
                  deleted || isDeleteDisabled || isDeletedOrLost
                    ? "pointer-events-none cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                }`}
                onClick={handleDeleteClick}
              >
                <FiTrash /> Delete
              </div>
            </div>
          </div>

          <div>
            {showEsign &&
              String(getUserRoleFromToken() || "")
                .toUpperCase()
                .trim() === String(userRoles.PCHO).toUpperCase() && (
                <div
                  title={deleted ? "User is deleted" : "Open DocuSeal Builder"}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    deleted
                      ? "pointer-events-none cursor-not-allowed opacity-50 bg-black text-white"
                      : "cursor-pointer bg-black text-white hover:bg-gray-900"
                  }`}
                  onClick={deleted ? () => {} : () => setBuilderModalOpen(true)}
                >
                  <FiEdit /> E-Sign
                </div>
              )}
          </div>
        </div>
      )}

      <DocxEditorModal
        open={isModalOpen}
        setOpen={setIsModalOpen}
        title="Edit Document"
        presignedGetUrl={urlForEditingDocs}
        saveBucketName={
          process.env.NEXT_PUBLIC_AWS_MODIFIED_CONTRACTS_BUCKET_NAME || ""
        }
        saveBucketKey={`${homeId}/${leadData?.userId}/${String(
          document?.documentName || "",
        ).replace(/\.docx$/i, "")}.docx`}
        documentName={`${String(document?.documentName || "").replace(
          /\.docx$/i,
          "",
        )}.docx`}
        onSaved={handleDocxSaved}
      />

      <DocusealBuilderModal
        open={builderModalOpen}
        setOpen={setBuilderModalOpen}
        buildToken={buildDocusealToken}
        onSend={handleBuilderSend}
      />

      <CommonModal
        modalOpen={showExpirationModal}
        setModalOpen={setShowExpirationModal}
        title="Upload File"
        crossCTA={true}
      >
        <div className="space-y-4 px-[20px]">
          <InputFieldComponent
            label={
              <>
                Select File <span className="text-red-500">*</span>
              </>
            }
            type="file"
            onChange={handleModalFileSelect}
            className="cursor-pointer"
            name=""
          />
          <InputFieldComponent
            label={
              <div className="flex items-center gap-2">
                <span>Expiration Date</span>

                <div className="relative group flex items-center">
                  <InfoIcon />

                  <div
                    className="
            absolute
            left-2
            top-6
            -translate-y-1/2
            hidden
            w-64
            rounded-lg
            bg-gray-900
            p-7
            text-s
            leading-4
            text-grey-100
            shadow-xxl
            group-hover:block
            z-[9999]
        "
                  >
                    Adding an expiration date lets us automatically create
                    reminders for you.
                  </div>
                </div>
              </div>
            }
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            name=""
            required={true}
            max="9999-12-31"
          />
          <Button
            buttonClick={handleExpirationUpload}
            disabled={uploading || !selectedFile}
            classname="w-full"
            name={uploading ? "Uploading..." : "Upload File"}
            type="submit"
          />
        </div>
      </CommonModal>

      <ViewOptionModal
        open={viewOptionModalOpen}
        setOpen={setViewOptionModalOpen}
        documentName={document?.documentLabel || document?.documentName}
        isLoading={viewOptionLoading}
        signedDocumentUrl={document?.signedDocumentUrl}
        onView={handleViewOptionView}
        onDownload={handleViewOptionDownload}
      />

      <DeleteConfirmationModal
        open={deleteModalOpen}
        setOpen={setDeleteModalOpen}
        documentName={document?.documentLabel || document?.documentName}
        isLoading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export const DeleteConfirmationModal = ({
  open,
  setOpen,
  documentName,
  isLoading = false,
  onConfirm,
  onCancel,
  title = "Delete Document",
  confirmText = "Confirm",
  cancelText = "Cancel",
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  documentName?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  title?: string;
  confirmText?: string;
  cancelText?: string;
}) => {
  const handleCancel = () => {
    onCancel?.();
    setOpen(false);
  };

  const displayDocumentName = String(documentName ?? "this document")
    .trim()
    .replace(/\s*\*+$/, "");

  return (
    <CommonModal title={title} modalOpen={open} setModalOpen={setOpen} crossCTA>
      <div className="font-poppins min-w-[450px] px-[20px] bg-[transparent]">
        <div className="mb-4">
          <div className="text-sm text-gray-700 mb-4">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900 ml-1">
              {displayDocumentName || "this document"}
            </span>
            &nbsp;&nbsp;?
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <Loader fullScreen={false} message="" />
          </div>
        ) : (
          <div className="flex justify-center gap-6">
            <Button
              name={confirmText}
              classname="bg-red-600 text-white"
              titleClass="!text-[14px]"
              buttonClick={onConfirm}
            />
            <Button
              name={cancelText}
              classname="bg-gray-300 text-black"
              titleClass="!text-[14px]"
              buttonClick={handleCancel}
            />
          </div>
        )}
      </div>
    </CommonModal>
  );
};
