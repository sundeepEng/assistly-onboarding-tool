"use client";
import React, { useEffect, useRef, useState } from "react";
import { Upload as FiUpload, InfoIcon } from "lucide-react";

import axios from "axios";
import Cookies from "js-cookie";
import CommonModal from "../../commonComponents/common-modal";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { uploadToS3 } from "../../utils/uploadToS3";
import {
  GetUsersPath,
  personalDocsOfPCGAllowedFormats,
  USER_PATH_OMIT_FIELDS,
  UserPath,
  userRoles,
} from "../../utils/constants";
import { useAppDispatch } from "../../redux/hooks";
import { omit } from "../../utils/dateUtils";
import { v4 as uuidv4 } from "uuid";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../utils/auth";
import { DocumentCardUi, type DocumentItem } from "./document-card-ui";
import InputFieldComponent from "../../commonComponents/input-field-component";
import Button from "../../commonComponents/button";

// DocumentItem is imported from ./document-card-ui

interface DocumentsProps {
  documents: DocumentItem[];
  additionalDocuments: DocumentItem[];
  onDelete: (document: any) => void;
  leadData: any;
  allowedFormats?: Record<string, string>;
  maxSizeMB?: number;
  onUploadComplete?: (
    uploadedFiles: {
      fileUrl: string;
      documentType: string;
      documentName: string;
      documentCategory?: string;
      isRequiredDocument?: boolean;
    }[],
  ) => void;
  deleted?: boolean;
}

const Documents: React.FC<DocumentsProps> = ({
  leadData,
  documents,
  additionalDocuments,
  allowedFormats = personalDocsOfPCGAllowedFormats,
  onDelete,
  maxSizeMB = 50,
  onUploadComplete,
  deleted,
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editDocumentModalOpen, setEditDocumentModalOpen] = useState(false);
  const [uploadDocuments, setUploaddocuments] =
    useState<DocumentItem[]>(documents);
  const otherDocumetsBucketName =
    process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;
  const dispatch = useAppDispatch();
  const homeId = getHomeIdFromToken();
  const viewerRoleUpper = String(
    getUserRoleFromToken() || Cookies.get("role") || "",
  ).toUpperCase();
  const viewedPersonaUpper = String(leadData?.role || "").toUpperCase();

  const isSeniorPersona =
    viewedPersonaUpper === String(userRoles.SENIOR).toUpperCase() ||
    viewedPersonaUpper === String(userRoles.LEAD).toUpperCase();
  const isPcgPersona =
    viewedPersonaUpper === String(userRoles.PCG).toUpperCase() ||
    viewedPersonaUpper === String(userRoles.PCGLEAD).toUpperCase();

  const [totalRequired, setTotalRequired] = useState(
    documents?.filter((doc) => doc.required).length || 0,
  );
  const [uploadedRequired, setUploadedRequired] = useState(0);
  const [progress, setProgress] = useState(0);

  const [customTemplateModalOpen, setCustomTemplateModalOpen] = useState(false);
  const [customTemplateFile, setCustomTemplateFile] = useState<File | null>(
    null,
  );
  const [customTemplateAllUsers, setCustomTemplateAllUsers] = useState(true);
  const [customTemplateUploading, setCustomTemplateUploading] = useState(false);

  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(
    null,
  );
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setUploaddocuments(documents);
  }, [documents]);

  const patchUploadedDocument = (args: {
    documentId?: string;
    documentName?: string;
    documentUrl: string;
    documentType?: string;
  }) => {
    const id = String(args.documentId || "");
    const name = String(args.documentName || "");
    if (!args.documentUrl) return;

    setUploaddocuments((prev) =>
      (Array.isArray(prev) ? prev : []).map((d) => {
        const sameId = id && String((d as any)?.documentId || "") === id;
        const sameName =
          !id &&
          name &&
          String((d as any)?.documentName || "").toLowerCase() ===
            name.toLowerCase();

        if (!sameId && !sameName) return d;
        return {
          ...d,
          documentUrl: args.documentUrl,
          documentType: (d as any)?.documentType || args.documentType,
          documentName: (d as any)?.documentName || args.documentName,
        } as any;
      }),
    );
  };

  const handleUploadCustomTemplate = async () => {
    try {
      // 1) Basic validation (file + format + required env/state)
      const file = customTemplateFile;
      if (!file) return;

      const isDocx =
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.toLowerCase().endsWith(".docx");

      if (!isDocx) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Only DOCX files are allowed."));
        return;
      }

      // If "Apply to all" is enabled, templates go to the shared contracts bucket.
      // Otherwise, upload under the target user's folder in user-documents bucket.
      const bucketName = customTemplateAllUsers
        ? process.env.NEXT_PUBLIC_AWS_ORIGINAL_CONTRACTS_BUCKET_NAME
        : process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;
      if (!bucketName) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            customTemplateAllUsers
              ? "Missing original contracts bucket name."
              : "Missing user documents bucket name.",
          ),
        );
        return;
      }

      const roleUpper = String(leadData?.role || "").toUpperCase();
      const personaFolder =
        roleUpper === String(userRoles.SENIOR).toUpperCase() ||
        roleUpper === String(userRoles.LEAD).toUpperCase()
          ? "Senior"
          : "PCG";

      const base = String(homeId || "").replace(/^\/+|\/+$/g, "");
      if (!base) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Home ID is missing."));
        return;
      }

      const targetUserId = String(leadData?.userId || "");
      if (!customTemplateAllUsers && !targetUserId) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("User ID is missing."));
        return;
      }

      setCustomTemplateUploading(true);

      // 2) List existing objects under the target prefix so we can generate a unique filename
      // (avoid overwriting a template with the same name)
      const listPrefix = customTemplateAllUsers
        ? `${base}/${personaFolder}/`
        : `${base}/${targetUserId}/`;

      const listResp = await fetch("/api/s3/list-objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bucket: bucketName,
          prefix: listPrefix,
        }),
      });

      const listData: any = listResp.ok ? await listResp.json() : null;
      const contents: any[] = listData?.contents ?? [];
      const existingKeys = new Set(
        contents.map((o) => String(o?.key || "")).filter(Boolean),
      );

      const sanitizeBaseName = (name: string) =>
        name
          .trim()
          .replace(/\.[^.]+$/i, "")
          .replace(/[^a-zA-Z0-9 _-]+/g, "")
          .replace(/[\s]+/g, " ")
          .trim();

      const originalBase = sanitizeBaseName(file.name || "template");
      const safeBase = originalBase || "template";

      const keyExists = (fileName: string) =>
        existingKeys.has(`${listPrefix}${fileName}`);

      let documentName = `${safeBase}.docx`;
      if (keyExists(documentName)) {
        let i = 2;
        while (keyExists(`${safeBase}_${i}.docx`)) i++;
        documentName = `${safeBase}_${i}.docx`;
      }

      // 3) Upload to S3
      const bucketKey = `${listPrefix}${documentName}`;
      const uploadedUrl = await uploadToS3(file, bucketKey, bucketName, true);

      if (!uploadedUrl) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Template upload failed."));
        return;
      }

      // 4) Persist document reference into the user(s) profile documents list
      const loggedInUserId = getUserIdFromToken() || "";
      const newDoc = {
        documentId: uuidv4(),
        documentType: ".docx",
        documentName,
        documentUrl: uploadedUrl,
        createdByUserId: loggedInUserId,
        createdAt: new Date().toISOString(),
        documentCategory: "onboarding",
        isRequiredDocument: false,
      };

      const token = Cookies.get("idToken");
      if (!token) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Unauthorized"));
        return;
      }

      // If applying for all, fetch all users in the home for the relevant persona roles and update each.
      // Otherwise, only update the currently viewed user.
      const userTypesToFetch = isSeniorPersona
        ? [userRoles.SENIOR, userRoles.LEAD]
        : [userRoles.PCG, userRoles.PCGLEAD, userRoles.PCHO];

      const userResponses = await Promise.all(
        userTypesToFetch.map((ut) =>
          axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}${GetUsersPath}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            params: {
              userType: ut,
              homeId: leadData?.homeId,
            },
          }),
        ),
      );

      const users: any[] = userResponses
        .flatMap((r) => r?.data?.users ?? [])
        .filter(Boolean);

      const dedupedById = new Map<string, any>();
      for (const u of users) {
        const id = String(u?.userId || "");
        if (!id) continue;
        if (!dedupedById.has(id)) dedupedById.set(id, u);
      }

      const dedupedUsers = Array.from(dedupedById.values());
      const targets = customTemplateAllUsers ? dedupedUsers : [leadData];

      for (const u of targets) {
        if (!u?.userId) continue;
        const existingDocs = Array.isArray(u?.documents) ? u.documents : [];
        const already = existingDocs.some(
          (d: any) =>
            String(d?.documentName || "").toLowerCase() ===
            documentName.toLowerCase(),
        );
        if (already) continue;

        const updatedUser = {
          ...u,
          documents: [...existingDocs, { ...newDoc, documentId: uuidv4() }],
        };

        const cleaned = omit(updatedUser, USER_PATH_OMIT_FIELDS);
        await axios.put(
          `${process.env.NEXT_PUBLIC_BASE_URL}${UserPath}/${u.userId}`,
          cleaned,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }

      // 5) Patch UI immediately (so the new template shows up without refresh)
      onUploadComplete?.([
        {
          fileUrl: uploadedUrl,
          documentType: ".docx",
          documentName,
          documentCategory: "onboarding",
          isRequiredDocument: false,
        },
      ]);

      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("Template uploaded successfully."));
      setCustomTemplateModalOpen(false);
    } catch (e) {
      console.error(e);
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          e?.response?.data?.error || "Unable to upload template.",
        ),
      );
    } finally {
      setCustomTemplateUploading(false);
    }
  };

  useEffect(() => {
    const calculateProgress = async () => {
      const requiredDocs = documents?.filter((doc) => doc.required) || [];
      let completed = 0;

      for (const doc of requiredDocs) {
        // If not uploaded at all, it's not complete
        if (doc.status !== "Uploaded") continue;

        // No placeholder validation anymore: uploaded == complete
        completed++;
      }

      const total = requiredDocs.length;
      setTotalRequired(total);
      setUploadedRequired(completed);
      setProgress(total > 0 ? (completed / total) * 100 : 0);
    };

    calculateProgress();
  }, [documents]);

  const handleFileChange = async (
    document: any,
    event: React.ChangeEvent<HTMLInputElement>,
    documentExpiryDateRequired?: string,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;
    // Validate format
    if (!allowedFormats[file.type]) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Invalid file format"));
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(`File too large (Max ${maxSizeMB}MB)`));
      return;
    }

    const bucketUploadPath = `${homeId}/${leadData?.userId}/${document?.documentName}`;

    const bucketName =
      document?.documentCategory === "onboarding"
        ? process.env.NEXT_PUBLIC_AWS_MODIFIED_CONTRACTS_BUCKET_NAME
        : process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

    const uploadedFileUrl = await uploadToS3(
      file,
      bucketUploadPath,
      bucketName,
    );

    if (uploadedFileUrl) {
      const uploadedFile = {
        fileUrl: uploadedFileUrl,
        documentType: file.type,
        documentName: document?.documentName,
      };
      if (documentExpiryDateRequired) {
        (uploadedFile as any).documentExpiryDateRequired =
          documentExpiryDateRequired;
        (uploadedFile as any).documentExpiryDate = documentExpiryDateRequired;
      }
      onUploadComplete([uploadedFile]); // pass uploaded file
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Not able to upload file, please try again"),
      );
    }

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadSelectedFile = async (
    document: any,
    file: File,
    documentExpiryDateRequired?: string,
  ) => {
    // Validate format
    if (!allowedFormats[file.type]) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Invalid file format"));
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(`File too large (Max ${maxSizeMB}MB)`));
      return;
    }

    const bucketUploadPath = `${homeId}/${leadData?.userId}/${document?.documentName}`;

    const bucketName =
      document?.documentCategory === "onboarding"
        ? process.env.NEXT_PUBLIC_AWS_MODIFIED_CONTRACTS_BUCKET_NAME
        : process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

    const uploadedFileUrl = await uploadToS3(
      file,
      bucketUploadPath,
      bucketName,
    );

    if (uploadedFileUrl) {
      const uploadedFile: any = {
        fileUrl: uploadedFileUrl,
        documentType: file.type,
        documentName: document?.documentName,
      };

      if (documentExpiryDateRequired) {
        uploadedFile.documentExpiryDateRequired = documentExpiryDateRequired;
        uploadedFile.documentExpiryDate = documentExpiryDateRequired;
      }

      onUploadComplete?.([uploadedFile]);
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Not able to upload file, please try again"),
      );
    }
  };

  const handleExpirationUpload = async () => {
    if (!selectedDocument || !selectedFile) return;

    try {
      setUploading(true);

      const documentToUpload =
        selectedDocument.documentCategory === "other"
          ? {
              ...selectedDocument,
              documentName: selectedFile.name.replace(/\.[^./]+$/, ""),
            }
          : selectedDocument;

      await uploadSelectedFile(documentToUpload, selectedFile, expirationDate);

      setShowExpirationModal(false);
      setSelectedFile(null);
      setExpirationDate("");
      setSelectedDocument(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Document Management
          </h1>

          {viewerRoleUpper === String(userRoles.PCHO).toUpperCase() &&
          (isSeniorPersona || isPcgPersona) ? (
            <button
              type="button"
              className={`px-3 py-2 rounded-md bg-black text-white text-sm hover:bg-gray-900 ${
                deleted
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
              onClick={() => {
                setCustomTemplateFile(null);
                setCustomTemplateAllUsers(true);
                setCustomTemplateModalOpen(true);
              }}
            >
              + Add New Template
            </button>
          ) : null}
        </div>
      </div>

      {/* Upload custom template modal */}
      <CommonModal
        modalOpen={customTemplateModalOpen}
        setModalOpen={setCustomTemplateModalOpen}
        title="Upload custom template"
        width="600px"
        crossCTA={true}
      >
        <div className="flex flex-col gap-4">
          <div className="text-sm text-gray-700">
            Upload a custom DOCX template for
            {isSeniorPersona
              ? " Seniors and Senior Leads"
              : " Care Team and Care Leads"}
            .
          </div>

          <div>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) =>
                setCustomTemplateFile(e.target.files?.[0] || null)
              }
            />
          </div>

          <InputFieldComponent
            label={
              <div className="flex items-center gap-2">
                <span>Expiration Date</span>

                <div className="relative group flex items-center">
                  <InfoIcon className="h-4 w-4 cursor-pointer" />

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

          <label className="flex items-center gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={customTemplateAllUsers}
              onChange={(e) => setCustomTemplateAllUsers(e.target.checked)}
            />
            Apply this template to all
            {isSeniorPersona
              ? " seniors and senior leads"
              : " care team and care leads"}
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900"
              onClick={() => setCustomTemplateModalOpen(false)}
              disabled={customTemplateUploading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-black text-white"
              disabled={!customTemplateFile || customTemplateUploading}
              onClick={handleUploadCustomTemplate}
            >
              {customTemplateUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </CommonModal>

      {/* Onboard documents section */}
      <section className="mb-8">
        <div className="flex flex-wrap gap-4">
          {uploadDocuments?.map((doc, index) => {
            return (
              <DocumentCardUi
                key={doc.documentId}
                document={doc}
                handleFileChange={handleFileChange}
                onDelete={onDelete}
                leadData={leadData}
                index={index}
                deleted={deleted}
                onPatchedDocument={patchUploadedDocument}
              />
            );
          })}
        </div>
      </section>

      {/* Additional documents section */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Additional Documents
        </h2>
        <div
          className={`flex flex-wrap gap-4 ${
            deleted ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <div
            className={`flex gap-4 flex-wrap ${
              deleted ? "pointer-events-none" : ""
            }`}
          >
            {/* Always keep one empty card */}
            <EmptyUploadDocCard
              onClick={() => {
                setSelectedFile(null);
                setExpirationDate("");
                setShowExpirationModal(true);

                setSelectedDocument({
                  documentName: "Additional Document",
                  documentCategory: "other",
                } as any);
              }}
            />
            {additionalDocuments?.map((doc, index) => (
              <DocumentCardUi
                key={doc.documentId}
                document={doc}
                handleFileChange={handleFileChange}
                onDelete={onDelete}
                leadData={leadData}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

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
            onChange={(e: any) => {
              const f = e?.target?.files?.[0] || null;
              setSelectedFile(f);
            }}
            className="cursor-pointer"
            name=""
          />
          <InputFieldComponent
            label={
              <div className="flex items-center gap-2">
                <span>Expiration Date</span>

                <div className="relative group flex items-center">
                  <InfoIcon className="h-4 w-4 cursor-pointer" />

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
    </div>
  );
};

export default Documents;

export const EmptyUploadCard: React.FC<{ onUpload: (file: File) => void }> = ({
  onUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg p-6 cursor-pointer hover:bg-gray-100 w-[350px] h-[210px]"
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFileChange}
      />
      <FiUpload size={28} className="text-gray-500" />
      <p className="text-gray-600 mt-2">Click to upload document</p>
    </div>
  );
};

export const EmptyUploadDocCard: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => {
  return (
    <div
      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg p-6 cursor-pointer hover:bg-gray-100 w-[350px] h-[210px]"
      onClick={onClick}
    >
      <FiUpload size={28} className="text-gray-500" />
      <p className="text-gray-600 mt-2">Click to upload document</p>
    </div>
  );
};
