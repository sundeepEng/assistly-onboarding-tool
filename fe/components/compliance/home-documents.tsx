import { UploadedFile } from "../../commonComponents/file-upload-manager";
import useGetById from "../../services/getById";
import {
  HOME_PATH_OMIT_FIELDS,
  homeDocsAllowedFormats,
  HOMEDOCUMENTS,
  homePath,
  InHomeCare,
  InHomeCareDocuments,
  UserPath,
  userRoles,
} from "../../utils/constants";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import { v4 as uuidv4 } from "uuid";
import _ from "lodash";
import { omit } from "../../utils/dateUtils";
import useUpsert from "../../services/upsert";
import fetchPreSignedUrl from "../../services/get-presigned-url";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../utils/auth";
import {
  EmptyUploadCard,
  EmptyUploadDocCard,
} from "../documents/documents-card";
import {
  Trash as FiTrash,
  Eye as FiEye,
  Edit as FiEdit,
  Upload as FiUpload,
  InfoIcon,
} from "lucide-react";
import { useGetHomeType } from "../../utils/gethomeType";
import { useEffect, useMemo, useState } from "react";
import { DeleteConfirmationModal } from "../documents/document-card-ui";
import CommonModal from "../../commonComponents/common-modal";
import InputFieldComponent from "../../commonComponents/input-field-component";
import Button from "../../commonComponents/button";
import { CheckValidityOfDocument } from "../../utils/checkValidityOfDocument";
import { dateFormat } from "../../utils/dateUtils";
import DocxEditorModal from "../documents/docx-editor-modal";
import DocusealBuilderModal from "../documents/docuseal-builder-modal";
import { fetchDocusealBuilderToken } from "../../services/docuseal-builder-token";
import { ViewOptionModal } from "../documents/view-option-modal";

export default function HomeDocuments() {
  const dispatch = useAppDispatch();
  const homeId = getHomeIdFromToken();
  const loggedInUserId = getUserIdFromToken();
  const loggedInUserRole = getUserRoleFromToken();

  const [expirationUploadModalOpen, setExpirationUploadModalOpen] =
    useState(false);
  const [expirationUploadDocType, setExpirationUploadDocType] =
    useState<any>(null);
  const [expirationUploadFile, setExpirationUploadFile] = useState<File | null>(
    null,
  );
  const [expirationUploadDate, setExpirationUploadDate] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedFileToDelete, setSelectedFileToDelete] =
    useState<UploadedFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [customTemplateModalOpen, setCustomTemplateModalOpen] = useState(false);
  const [customTemplateFile, setCustomTemplateFile] = useState<File | null>(
    null,
  );
  const [customTemplateUploading, setCustomTemplateUploading] = useState(false);

  const [uploading, setUploading] = useState(false);

  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;

  const { data: HomeData } = useGetById({
    key: "home",
    payload: { id: homeId, path: homePath, enabled: !!homeId },
  });

  const { data: loggedInUserData } = useGetById({
    key: "loggedInUser",
    payload: {
      path: UserPath,
      id: loggedInUserId || "",
      enabled: !!loggedInUserId,
    },
  });

  const { mutate } = useUpsert();

  const transformDocuments = (dbDocuments: any[]): UploadedFile[] => {
    return (dbDocuments || []).map((doc) => ({
      documentId: doc.documentId,
      documentName: doc.documentName,
      documentLabel: doc.documentName,
      uploadDate: new Date(doc.createdAt),
      expirationDate: doc.documentExpiryDate || undefined,
      url: doc.documentUrl,
      uploadedBy: doc.createdByUserId,
      documentType: doc.documentType,
      isRequiredDocument: doc.isRequiredDocument || false,
      documentCategory: doc.documentCategory || "onboarding",
    }));
  };

  const AdditionalDocumentCard = ({ doc }: { doc: UploadedFile }) => {
    const { data: uploadedByUser } = useGetById({
      key: "uploadedByUser",
      payload: {
        path: UserPath,
        id: String(doc?.uploadedBy || ""),
        enabled: !!doc?.uploadedBy,
      },
    });

    const expirationMessage = useMemo(() => {
      const expiry = String(doc?.expirationDate || "");
      if (!expiry) return null;
      return CheckValidityOfDocument({
        alertPeriodInDays: 30,
        expirationDate: expiry,
      });
    }, [doc?.expirationDate]);

    return (
      <div
        key={doc.documentId}
        className=" bg-white border-[1px] border-solid border-[#D1D5DB] rounded-lg p-4 w-[320px] h-[210px] hover:shadow-md transition-shadow flex flex-col"
      >
        <div className="flex justify-between items-start mb-[10px]">
          <div className="text-md font-medium text-gray-900 truncate max-w-[250px]">
            {doc.documentName}
          </div>
        </div>

        <div className="flex flex-col justify-between flex-1">
          <div className="text-[14px]">
            <p className="m-0">
              Uploaded by: {String((uploadedByUser as any)?.name || "-")}
            </p>
            <p className="m-0">
              Date: {doc.uploadDate?.toLocaleDateString?.() ?? "-"}
            </p>
            {doc?.expirationDate && (
              <p
                className={`m-0 ${(expirationMessage as any)?.color || ""}`.trim()}
              >
                Expiry Date: {dateFormat(String(doc.expirationDate))}
              </p>
            )}
            {expirationMessage && (
              <p
                className={`m-0 ${(expirationMessage as any)?.color || ""}`.trim()}
              >
                {String((expirationMessage as any)?.message || "")}
              </p>
            )}
          </div>

          <div className="flex justify-between mt-4">
            <div
              onClick={() => handleView(doc)}
              className="flex items-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg cursor-pointer"
            >
              <FiEye /> View
            </div>

            <div
              onClick={() => openDeletePopup(doc)}
              className="flex items-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg cursor-pointer"
            >
              <FiTrash /> Delete
            </div>
          </div>
        </div>
      </div>
    );
  };

  const dbDocuments = _.get(HomeData?.home, "documents", []);

  // Required/onboarding docs (placeholders + templates)
  const requiredDocs = dbDocuments.filter(
    (doc: any) => (doc.documentCategory || "onboarding") !== "other",
  );

  // Additional docs (category === other)
  const otherDocsRaw = dbDocuments.filter(
    (doc: any) => doc.documentCategory === "other",
  );

  const formattedFiles = transformDocuments(requiredDocs);
  const additionalDocuments = transformDocuments(otherDocsRaw);

  const baseDocTypes = isInHomeCare ? InHomeCareDocuments : HOMEDOCUMENTS;

  const FIRE_DRILL_DOC_NAME = "Fire Drill and Safety Log";

  const normalize = (str: string) =>
    String(str || "")
      .toLowerCase()
      .replace(/[\s_\-().]+/g, "");

  const isBaseHomeDocName = (name: string) => {
    const nameNorm = normalize(name);
    return (baseDocTypes || []).some((dt: any) =>
      nameNorm.includes(normalize(dt?.name)),
    );
  };

  const isCustomTemplateHomeDocName = (name: string) => {
    if (!name) return false;
    return !isBaseHomeDocName(name);
  };

  const supportsHomeDocEditAndEsign = (docName: string) => {
    return (
      docName === FIRE_DRILL_DOC_NAME || isCustomTemplateHomeDocName(docName)
    );
  };

  const customTemplateDocTypes = requiredDocs
    .filter((d: any) => (d.documentCategory || "onboarding") !== "other")
    .filter((d: any) => {
      const name = String(d?.documentName || "");
      if (!name) return false;
      return (
        supportsHomeDocEditAndEsign(name) && isCustomTemplateHomeDocName(name)
      );
    })
    .map((d: any) => ({
      id: d?.documentId || uuidv4(),
      name: String(d?.documentName || ""),
      label: String(d?.documentName || ""),
      required: false,
    }));

  const documentTypesForUi: any = [...baseDocTypes, ...customTemplateDocTypes];

  const handleUploadCustomTemplate = async ({ expirationDate }: any) => {
    const file = customTemplateFile;
    if (!file) return;

    const nameLower = String(file.name || "").toLowerCase();
    if (!nameLower.endsWith(".docx")) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Please upload a .docx template."));
      return;
    }

    try {
      setCustomTemplateUploading(true);

      const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;
      if (!bucketName) {
        throw new Error("Missing user documents bucket name.");
      }

      const baseName = String(file.name)
        .replace(/\.docx$/i, "")
        .trim();
      const key = `${homeId}/ComplianceDocuments/${baseName}.docx`;

      const uploadedFileUrl = await uploadToS3(file, key, bucketName);
      if (!uploadedFileUrl) throw new Error("Upload failed");

      const uploadedFile: any = {
        documentId: uuidv4(),
        documentCategory: "onboarding",
        documentType: ".docx",
        documentUrl: uploadedFileUrl,
        documentName: baseName,
        createdByUserId: loggedInUserId,
        createdAt: new Date().toISOString(),
        isRequiredDocument: false,
      };

      if (expirationDate) {
        uploadedFile.documentExpiryDate = expirationDate;
      }
      const existingDocuments = _.get(HomeData?.home, "documents", []);
      const updatedDocuments = [...existingDocuments, uploadedFile];

      const homeDataToUpdate = {
        ...HomeData?.home,
        documents: updatedDocuments,
      };

      const cleanedData = omit(homeDataToUpdate, HOME_PATH_OMIT_FIELDS);

      await new Promise<void>((resolve, reject) => {
        mutate(
          { data: cleanedData, path: homePath },
          {
            onSuccess: () => resolve(),
            onError: () => reject(new Error("Unable to save template.")),
          },
        );
      });

      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("Template uploaded successfully."));
      setCustomTemplateModalOpen(false);
      setCustomTemplateFile(null);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          String(e?.message || "Unable to upload template."),
        ),
      );
    } finally {
      setCustomTemplateUploading(false);
    }
  };

  const handleUpload = async ({
    file,
    expirationDate,
    documentName,
    documentCategory = "onboarding",
    isRequiredDocument,
  }: any) => {
    if (!file) return;

    const derivedNameFromFile = String(file?.name || "")
      .replace(/\.[^.]+$/, "")
      .trim();
    const resolvedCategory =
      documentCategory === "onboarding" && !String(documentName || "").trim()
        ? "other"
        : documentCategory;
    const resolvedDocumentName =
      String(documentName || "").trim() || derivedNameFromFile;

    if (!homeDocsAllowedFormats[file?.type]) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          `Only PDF, DOC, DOCX, JPG, PNG formats are allowed.`,
        ),
      );
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(`File too large (Max ${2}MB)`));
      return;
    }
    setUploading(true);
    // Keep paths consistent for upload + delete
    const folder =
      resolvedCategory === "other"
        ? "ComplianceDocuments/Other"
        : "ComplianceDocuments";

    const derivedExt = String(homeDocsAllowedFormats[file.type] || "")
      .toLowerCase()
      .trim();

    const objectName =
      resolvedCategory === "other"
        ? String(file.name || "")
        : `${String(resolvedDocumentName || "").trim()}${derivedExt || ""}`;

    const bucketUploadPath = `${homeId}/${folder}/${objectName}`;
    const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

    const uploadedFileUrl = await uploadToS3(
      file,
      bucketUploadPath,
      bucketName,
    );

    if (!uploadedFileUrl) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Not able to upload file, please try again"),
      );
      setUploading(false);
      return;
    }

    const uploadedFile: any = {
      documentId: uuidv4(),
      documentCategory: resolvedCategory,
      documentType: homeDocsAllowedFormats[file.type],
      documentUrl: uploadedFileUrl,
      documentName: resolvedDocumentName,
      createdByUserId: loggedInUserId,
      createdAt: new Date().toISOString(),
      // required docs default true, "other" default false
      isRequiredDocument:
        typeof isRequiredDocument === "boolean"
          ? isRequiredDocument
          : resolvedCategory !== "other",
    };

    if (expirationDate) {
      uploadedFile.documentExpiryDate = expirationDate;
    }

    const existingDocuments = _.get(HomeData?.home, "documents", []);

    //  For required docs: replace by documentName (your current behavior)
    //  For additional docs ("other"): DO NOT replace; allow multiple uploads

    const updatedDocuments =
      resolvedCategory === "other"
        ? [...existingDocuments, uploadedFile]
        : [
            ...existingDocuments.filter(
              (doc: any) => doc.documentName !== resolvedDocumentName,
            ),
            uploadedFile,
          ];

    const homeDataToUpdate = {
      ...HomeData?.home,
      documents: updatedDocuments,
    };

    const cleanedData = omit(homeDataToUpdate, HOME_PATH_OMIT_FIELDS);
    mutate(
      { data: cleanedData, path: homePath },
      {
        onSuccess: () => {
          setUploading(false);
          setExpirationUploadModalOpen(false);
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Files Uploaded Successfully!"));
        },
        onError: () => {
          setUploading(false);
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              "Not able to upload Files, please try again",
            ),
          );
        },
      },
    );
  };

  const handleView = async (file: UploadedFile) => {
    const enabled = !!file.url;
    if (!enabled) return;
    try {
      const url = await fetchPreSignedUrl(file.url);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (error) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Unable to load File. Please try again."),
      );
    }
  };

  const upsertHomeDocuments = async (nextDocuments: any[]) => {
    const homeDataToUpdate = {
      ...HomeData?.home,
      documents: nextDocuments,
    };

    const cleanedData = omit(homeDataToUpdate, HOME_PATH_OMIT_FIELDS);

    await new Promise<void>((resolve, reject) => {
      mutate(
        { data: cleanedData, path: homePath },
        {
          onSuccess: () => resolve(),
          onError: () => reject(new Error("Unable to update home documents.")),
        },
      );
    });
  };

  const getS3KeyFromUrl = (src: string) => {
    try {
      const u = new URL(src);
      return decodeURIComponent(String(u.pathname || "").replace(/^\//, ""));
    } catch {
      return "";
    }
  };

  const ensureDocxKey = (key: string) => {
    if (!key) return key;
    if (key.toLowerCase().endsWith(".docx")) return key;
    return key.replace(/\.[^./]+$/, "") + ".docx";
  };

  const isWordDocument = (doc: any) => {
    const t = String(doc?.documentType || "")
      .toLowerCase()
      .trim();
    const name = String(doc?.documentName || "")
      .toLowerCase()
      .trim();
    const url = String(doc?.documentUrl || "")
      .toLowerCase()
      .trim();
    if (t === ".doc" || t === ".docx" || t === "doc" || t === "docx")
      return true;
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
  };

  const homeOnboardingDocTypes = useMemo(() => {
    return documentTypesForUi;
  }, [documentTypesForUi]);

  const isPcho =
    String(loggedInUserRole || "")
      .toUpperCase()
      .trim() === String(userRoles.PCHO).toUpperCase();

  const HomeOnboardingCard = ({ docType }: { docType: any }) => {
    const uploadedDoc = requiredDocs.find(
      (d: any) => String(d?.documentName || "") === String(docType?.name || ""),
    );

    const { data: uploadedByUser } = useGetById({
      key: "uploadedByUser",
      payload: {
        path: UserPath,
        id: String(uploadedDoc?.createdByUserId || ""),
        enabled: !!uploadedDoc?.createdByUserId,
      },
    });

    const [editOpen, setEditOpen] = useState(false);
    const [builderOpen, setBuilderOpen] = useState(false);
    const [docusealDraftKey, setDocusealDraftKey] = useState<number>(
      Date.now(),
    );
    const [viewOptionOpen, setViewOptionOpen] = useState(false);
    const [viewOptionLoading, setViewOptionLoading] = useState(false);
    const [pendingViewUrl, setPendingViewUrl] = useState<string>("");
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [editPresignedUrl, setEditPresignedUrl] = useState<string | null>(
      null,
    );

    const enabled = !!uploadedDoc?.documentUrl;
    const supports = supportsHomeDocEditAndEsign(String(docType?.name || ""));
    const canEdit = enabled && supports && isWordDocument(uploadedDoc);
    const canEsign = enabled && supports && isPcho;

    const requiresExpiration = docType?.uploadType === "withExpiration";

    const expirationMessage = useMemo(() => {
      if (!requiresExpiration) return null;
      const expiry = String(uploadedDoc?.documentExpiryDate || "");
      if (!expiry) return null;

      return CheckValidityOfDocument({
        alertPeriodInDays: Number(docType?.alertPeriodInDays || 0),
        expirationDate: expiry,
      });
    }, [
      docType?.alertPeriodInDays,
      requiresExpiration,
      uploadedDoc?.documentExpiryDate,
    ]);

    useEffect(() => {
      const run = async () => {
        if (!editOpen) return;
        const src = String(uploadedDoc?.documentUrl || "");
        if (!src) return;
        const presigned = await fetchPreSignedUrl(src);
        setEditPresignedUrl(presigned || src);
      };
      run();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editOpen, uploadedDoc?.documentUrl]);

    const handleCardView = async () => {
      if (!enabled) return;

      const isWord = isWordDocument(uploadedDoc);
      if (isWord) {
        setPendingViewUrl(String(uploadedDoc?.documentUrl || ""));
        setViewOptionOpen(true);
        return;
      }

      await handleView(transformDocuments([uploadedDoc])[0]);
    };

    const buildDocusealToken = async () => {
      if (!uploadedDoc) throw new Error("Document is missing.");

      const roles = ["Resident", "PCHO"];
      const templateId = uploadedDoc?.documentTemplateId
        ? Number(uploadedDoc.documentTemplateId)
        : undefined;

      const externalIdPayload = templateId
        ? {
            homeId,
            documentId: uploadedDoc?.documentId,
            documentName: uploadedDoc?.documentName,
          }
        : {
            homeId,
            documentId: uploadedDoc?.documentId,
            documentName: uploadedDoc?.documentName,
            draftKey: docusealDraftKey,
          };

      let documentUrls: string[] | undefined = undefined;
      if (!templateId) {
        const src = String(uploadedDoc?.documentUrl || "");
        if (!src) throw new Error("Document URL is missing.");
        const presigned = await fetchPreSignedUrl(src);
        if (!presigned)
          throw new Error("Unable to load document URL for builder.");
        documentUrls = [presigned];
      }

      return fetchDocusealBuilderToken({
        integrationEmail: (loggedInUserData as any)?.email,
        name: uploadedDoc?.documentName || "Template",
        documentUrls,
        templateId,
        externalId: JSON.stringify(externalIdPayload),
        roles,
      });
    };

    const handleBuilderSend = async (data: any) => {
      if (!uploadedDoc) return;
      const maybeTemplateId =
        Number(data?.template_id) ||
        Number(data?.templateId) ||
        Number(data?.template?.id) ||
        Number(data?.template?.template_id);
      if (!maybeTemplateId) return;

      const existingDocuments = _.get(HomeData?.home, "documents", []);
      const updatedDocuments = existingDocuments.map((d: any) => {
        if (
          String(d?.documentId || "") !== String(uploadedDoc?.documentId || "")
        )
          return d;
        return {
          ...d,
          documentTemplateId: maybeTemplateId,
        };
      });

      await upsertHomeDocuments(updatedDocuments);
    };

    const handleEditSaved = async ({
      uploadedUrl,
      documentType,
    }: {
      uploadedUrl: string;
      documentType: string;
    }) => {
      if (!uploadedDoc) return;

      const existingDocuments = _.get(HomeData?.home, "documents", []);
      const updatedDocuments = existingDocuments.map((d: any) => {
        if (
          String(d?.documentId || "") !== String(uploadedDoc?.documentId || "")
        )
          return d;
        return {
          ...d,
          documentUrl: uploadedUrl,
          documentType,
          documentTemplateId: null,
        };
      });

      await upsertHomeDocuments(updatedDocuments);
      setDocusealDraftKey(Date.now());
    };

    const handleConfirmDelete = async () => {
      if (!uploadedDoc) return;
      try {
        setDeleteLoading(true);
        await handleDelete(transformDocuments([uploadedDoc])[0]);
        setDeleteOpen(false);
      } finally {
        setDeleteLoading(false);
      }
    };

    const handleViewOptionView = async () => {
      try {
        setViewOptionLoading(true);
        const url = await fetchPreSignedUrl(pendingViewUrl);
        if (url) window.open(url, "_blank");
        setViewOptionOpen(false);
      } catch {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage("Unable to load File. Please try again."),
        );
      } finally {
        setViewOptionLoading(false);
      }
    };

    const handleViewOptionDownload = async () => {
      try {
        setViewOptionLoading(true);
        const url = await fetchPreSignedUrl(pendingViewUrl);
        if (url) {
          const link = window.document.createElement("a");
          link.href = url;
          link.download = uploadedDoc?.documentName || "document";
          window.document.body.appendChild(link);
          link.click();
          window.document.body.removeChild(link);
        }
        setViewOptionOpen(false);
      } catch {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Unable to download File. Please try again.",
          ),
        );
      } finally {
        setViewOptionLoading(false);
      }
    };

    const saveBucketName =
      process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME || "";
    const saveKey = uploadedDoc?.documentUrl
      ? ensureDocxKey(getS3KeyFromUrl(String(uploadedDoc.documentUrl)))
      : `${homeId}/ComplianceDocuments/${String(docType?.name || "").replace(
          /\.docx$/i,
          "",
        )}.docx`;

    return (
      <div className="flex flex-col bg-white border-[2px] border-solid border-[#D1D5DB] rounded-lg p-4 w-[350px] hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center">
          <div className="text-sm font-medium text-gray-900 truncate max-w-[300px]">
            {docType?.name}
            {docType?.required && <span className="text-red-500">*</span>}
          </div>
        </div>

        {enabled ? (
          <div className="text-xs text-gray-600 mt-4 h-full">
            <div className="flex flex-col justify-between h-full">
              <div className="text-[14px]">
                <p className="m-0">
                  Uploaded by: {String((uploadedByUser as any)?.name || "-")}
                </p>
                <p className="m-0">
                  Date:{" "}
                  {uploadedDoc?.createdAt
                    ? new Date(
                        String(uploadedDoc.createdAt),
                      ).toLocaleDateString()
                    : "-"}
                </p>
                {requiresExpiration && uploadedDoc?.documentExpiryDate && (
                  <p
                    className={`m-0 ${(expirationMessage as any)?.color || ""}`.trim()}
                  >
                    Expires:{" "}
                    {dateFormat(String(uploadedDoc?.documentExpiryDate))}
                  </p>
                )}
              </div>

              {expirationMessage && (
                <div
                  className={`text-[14px] ${(expirationMessage as any)?.color || ""}`.trim()}
                >
                  {String((expirationMessage as any)?.message || "")}
                </div>
              )}

              <div className="flex justify-between mt-4">
                <div
                  onClick={handleCardView}
                  className="flex items-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg cursor-pointer"
                >
                  <FiEye /> View
                </div>

                {supports && (
                  <div
                    title={
                      canEdit ? "Edit document" : "Only DOC/DOCX can be edited"
                    }
                    onClick={canEdit ? () => setEditOpen(true) : () => {}}
                    className={`flex items-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg ${
                      canEdit
                        ? "cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <FiEdit /> Edit
                  </div>
                )}
                <div
                  onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg cursor-pointer"
                >
                  <FiTrash /> Delete
                </div>
              </div>

              <div className="flex justify-between mt-3">
                {supports && (
                  <div
                    title={
                      canEsign
                        ? "Open DocuSeal Builder"
                        : "E-Sign not available"
                    }
                    onClick={canEsign ? () => setBuilderOpen(true) : () => {}}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg w-full ${
                      canEsign
                        ? "cursor-pointer bg-black text-white"
                        : "opacity-50 cursor-not-allowed bg-black text-white"
                    }`}
                  >
                    <FiEdit /> E-Sign
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-gray-300 border-2 border-dashed bg-gray-50 rounded-lg p-4 text-center cursor-pointer mt-4">
            <div
              className="cursor-pointer flex flex-col items-center gap-2 text-gray-600"
              onClick={() => {
                setExpirationUploadDocType(docType);
                setExpirationUploadFile(null);
                setExpirationUploadDate("");
                setExpirationUploadModalOpen(true);
              }}
            >
              <FiUpload size={24} />
              <p className="text-sm">Click to upload</p>
            </div>
          </div>
        )}

        <DocxEditorModal
          open={editOpen}
          setOpen={setEditOpen}
          title="Edit Document"
          presignedGetUrl={editPresignedUrl}
          saveBucketName={saveBucketName}
          saveBucketKey={saveKey}
          documentName={`${String(
            uploadedDoc?.documentName || docType?.name || "",
          ).replace(/\.docx$/i, "")}.docx`}
          onSaved={handleEditSaved}
        />

        <DocusealBuilderModal
          open={builderOpen}
          setOpen={setBuilderOpen}
          buildToken={buildDocusealToken}
          onSend={handleBuilderSend}
          withSendButton={false}
        />

        <ViewOptionModal
          open={viewOptionOpen}
          setOpen={setViewOptionOpen}
          documentName={uploadedDoc?.documentName}
          isLoading={viewOptionLoading}
          signedDocumentUrl={uploadedDoc?.signedDocumentUrl}
          onView={handleViewOptionView}
          onDownload={handleViewOptionDownload}
        />

        <DeleteConfirmationModal
          open={deleteOpen}
          setOpen={setDeleteOpen}
          documentName={String(docType?.name || "")}
          isLoading={deleteLoading}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteLoading(false)}
        />
      </div>
    );
  };

  const handleDelete = async (file: UploadedFile) => {
    const fileName = file?.url?.split("/").pop();
    if (!fileName) return;

    const folder =
      file.documentCategory === "other"
        ? "ComplianceDocuments/Other"
        : "ComplianceDocuments";

    const bucketUploadPath = `${homeId}/${folder}/${fileName}`;
    const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

    const success: any = await deleteFromS3(
      fileName,
      bucketUploadPath,
      bucketName,
    );

    if (!success) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Not able to delete File, please try again"),
      );
      return;
    }

    const updatedDocuments = dbDocuments.filter(
      (doc: any) => doc.documentId !== file.documentId,
    );

    const homeDataToUpdate = {
      ...HomeData?.home,
      documents: updatedDocuments,
    };

    const cleanedData = omit(homeDataToUpdate, HOME_PATH_OMIT_FIELDS);

    mutate(
      { data: cleanedData, path: homePath },
      {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("File Deleted Successfully!"));
        },
        onError: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              "Not able to delete File, please try again",
            ),
          );
        },
      },
    );
  };

  const openDeletePopup = (file: UploadedFile) => {
    setSelectedFileToDelete(file);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedFileToDelete) return;

    setIsDeleting(true);

    try {
      await handleDelete(selectedFileToDelete); // reuse existing logic
      setDeleteModalOpen(false);
      setSelectedFileToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <CommonModal
        modalOpen={expirationUploadModalOpen}
        setModalOpen={(open: boolean) => {
          setExpirationUploadModalOpen(open);
          if (!open) {
            setExpirationUploadDocType(null);
            setExpirationUploadFile(null);
            setExpirationUploadDate("");
          }
        }}
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
              setExpirationUploadFile(f);
            }}
            className="cursor-pointer"
            name={""}
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
            value={expirationUploadDate}
            onChange={(e) => setExpirationUploadDate(e.target.value)}
            name=""
            required={true}
            max="9999-12-31"
          />
          <Button
            buttonClick={() => {
              handleUpload({
                file: expirationUploadFile,
                expirationDate: expirationUploadDate,
                documentName: String(expirationUploadDocType?.name || ""),
                documentCategory: "onboarding",
              });
            }}
            disabled={!expirationUploadFile || uploading}
            classname="w-full"
            name={uploading ? "Uploading..." : "Upload File"}
            type="submit"
          />
        </div>
      </CommonModal>

      <CommonModal
        title="Add New Template"
        modalOpen={customTemplateModalOpen}
        setModalOpen={(open: boolean) => {
          setCustomTemplateModalOpen(open);
          if (!open) {
            setCustomTemplateFile(null);
            setCustomTemplateUploading(false);
          }
        }}
        crossCTA={true}
      >
        <div className="space-y-4 px-[20px]">
          <InputFieldComponent
            label={
              <>
                Select DOCX Template <span className="text-red-500">*</span>
              </>
            }
            type="file"
            name={""}
            onChange={(e: any) => {
              const f = e.target.files?.[0] || null;
              setCustomTemplateFile(f);
            }}
            className="cursor-pointer"
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
            value={expirationUploadDate}
            onChange={(e) => setExpirationUploadDate(e.target.value)}
            name=""
            required={true}
            max="9999-12-31"
          />

          <Button
            name={customTemplateUploading ? "Uploading..." : "Upload Template"}
            classname="w-full bg-black text-white"
            titleClass="!text-[14px]"
            disabled={!customTemplateFile || customTemplateUploading}
            isLoading={customTemplateUploading}
            buttonClick={() =>
              handleUploadCustomTemplate({
                expirationDate: expirationUploadDate,
              })
            }
          />
        </div>
      </CommonModal>

      <div className="mx-auto font-poppins">
        <div className="flex  items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900 pr-4">
            Document Management
          </h1>
          <Button
            name={"+ Add New Template"}
            classname="bg-black text-white"
            titleClass="!text-[14px]"
            buttonClick={() => setCustomTemplateModalOpen(true)}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          {homeOnboardingDocTypes.map((dt: any) => (
            <HomeOnboardingCard key={String(dt?.id || dt?.name)} docType={dt} />
          ))}
        </div>
      </div>

      {/* Additional Documents section */}
      <section className="mb-8 mt-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Additional Documents
        </h2>

        <div className="flex flex-wrap gap-4">
          {/* Always keep one empty card */}
          <EmptyUploadDocCard
            onClick={() => {
              setExpirationUploadFile(null);
              setExpirationUploadDate("");
              setExpirationUploadModalOpen(true);
            }}
          />
          {additionalDocuments?.map((doc) => (
            <AdditionalDocumentCard key={doc.documentId} doc={doc} />
          ))}
        </div>
      </section>
      <DeleteConfirmationModal
        open={deleteModalOpen}
        setOpen={setDeleteModalOpen}
        documentName={selectedFileToDelete?.documentName}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setSelectedFileToDelete(null)}
      />
    </>
  );
}
