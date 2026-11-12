import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Card, ContactBlock, Row, SectionTitle } from "./face-sheet-components";
import useGetById from "../../services/getById";
import {
  background_check,
  CARE_TEAM_FACESHEET_DOC_TYPES,
  CLINICAL_USER_PATH_OMIT_FIELDS,
  cpr_and_first_aid,
  dl,
  FACESHEET_DOC_TYPES,
  tb_test,
  UserPath,
} from "../../utils/constants";
import { toTitleCase } from "../../utils/getSignatureUtil";
import Avatar from "../../commonComponents/avatar";
import {
  deepMerge,
  removeEmptyValuesDeep,
  safeStr,
  splitName,
} from "../../utils/facesheetUtil";
import {
  careTeamFaceSheetBaseSchema,
  CareTeamFaceSheetDraft,
} from "../../model/clinical/care-team-face-sheet-schema.model";
import { useZodForm } from "./inline-form";
import { useDispatch } from "react-redux";
import fetchPreSignedUrl from "../../services/get-presigned-url";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { RoleContext } from "../role-provider";
import { Role } from "../../utils/roles";
import { hasAccess } from "../../utils/roleAccess";
import {
  InlineInput,
  InlineSelect,
  UploadRow,
} from "../../commonComponents/inline-form-fields";
import { FaceSheetDraft } from "../../model/clinical/face-sheet.model";
import Button from "../../commonComponents/button";
import { omit } from "lodash";
import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import useUpdate from "../../services/update";
import { getHomeIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import { v4 as uuidv4 } from 'uuid';

const CARE_TEAM_DOC_SYNC_MAP = {
  backgroundCheck: {
    documentName: background_check,
  },
  tbTestResult: {
    documentName: tb_test,
  },
  drivingLicense: {
    documentName: dl,
  },
  cprCertificate: {
    documentName: cpr_and_first_aid,
  },
} as const;

type CareTeamFaceSheetDocType = keyof typeof CARE_TEAM_DOC_SYNC_MAP;
const ALLOWED_DOCUMENT_TYPES = [
  ".pdf",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];

const isAllowedDocumentType = (value?: string) => {
  return ALLOWED_DOCUMENT_TYPES.includes(String(value || "").toLowerCase());
};

const getSafeDocumentType = (faceSheetDoc: any, existingDoc?: any) => {
  const fromFaceSheetFileName = getFileExtension(faceSheetDoc?.fileName);
  const fromFaceSheetUrl = getFileExtension(faceSheetDoc?.fileUrl);
  const fromExistingDoc = existingDoc?.documentType;

  const finalType =
    fromFaceSheetFileName || fromFaceSheetUrl || fromExistingDoc || "";

  return isAllowedDocumentType(finalType) ? finalType : "";
};

const getDocumentBaseName = (documentName?: string) => {
  if (!documentName) return "";

  return (
    documentName
      .split("/")
      .pop()
      ?.replace(/\.[^/.]+$/, "")
      ?.trim()
      .toLowerCase() || ""
  );
};

const getFileExtension = (fileName?: string) => {
  if (!fileName) return "";

  const match = fileName.match(/\.[^/.]+$/);
  return match?.[0]?.toLowerCase() || "";
};

const createDocumentId = () => uuidv4();

const findUserDocumentByName = (documents: any[] = [], targetName: string) => {
  return documents.find(
    (doc: any) => getDocumentBaseName(doc?.documentName) === targetName,
  );
};

const convertUserDocToFaceSheetDoc = (userDoc: any) => {
  if (!userDoc?.documentUrl) return { status: "empty" };

  return {
    fileName: userDoc.documentName,
    fileSize: userDoc.fileSize ?? 0,
    fileUrl: userDoc.documentUrl,
    uploadedAt: userDoc.createdAt,
    status: "existing",
  };
};

function syncFaceSheetDocsToUserDocuments(
  pcgData: any,
  faceSheetDocuments: CareTeamFaceSheetDraft["documents"],
) {
  const existingUserDocuments = Array.isArray(pcgData?.documents)
    ? [...pcgData.documents]
    : [];

  // First remove already-invalid documents from payload.
  // This prevents backend validation failure for old records like documentType: "".
  const syncedDocuments = existingUserDocuments.filter((doc: any) => {
    if (!doc?.documentType) return false;
    return isAllowedDocumentType(doc.documentType);
  });

  Object.entries(CARE_TEAM_DOC_SYNC_MAP).forEach(([faceSheetKey, config]) => {
    const docType = faceSheetKey as CareTeamFaceSheetDocType;
    const faceSheetDoc = faceSheetDocuments?.[docType];

    const existingIndex = syncedDocuments.findIndex(
      (doc: any) =>
        getDocumentBaseName(doc?.documentName) === config.documentName,
    );

    const originalExistingDoc = existingUserDocuments.find(
      (doc: any) =>
        getDocumentBaseName(doc?.documentName) === config.documentName,
    );

    if (
      !faceSheetDoc ||
      faceSheetDoc.status === "empty" ||
      faceSheetDoc.status === "remove"
    ) {
      if (existingIndex !== -1) {
        syncedDocuments.splice(existingIndex, 1);
      }
      return;
    }

    if (!faceSheetDoc.fileUrl) return;

    const documentType = getSafeDocumentType(
      faceSheetDoc,
      originalExistingDoc,
    );

    // If we cannot determine a valid extension, do not send this doc
    // to top-level documents because backend will reject documentType: "".
    if (!documentType) {
      console.warn(
        `Skipping top-level document sync for ${config.documentName} because documentType is missing`,
        faceSheetDoc,
      );

      if (existingIndex !== -1) {
        syncedDocuments.splice(existingIndex, 1);
      }

      return;
    }

    const syncedUserDoc = {
      ...(existingIndex !== -1 ? syncedDocuments[existingIndex] : {}),

      documentId:
        existingIndex !== -1
          ? syncedDocuments[existingIndex]?.documentId
          : originalExistingDoc?.documentId || createDocumentId(),

      documentCategory:
        originalExistingDoc?.documentCategory || "other",

      documentType,
      documentName: config.documentName,
      documentUrl: faceSheetDoc.fileUrl,
      isRequiredDocument: true,

      createdByUserId:
        originalExistingDoc?.createdByUserId || pcgData?.userId,

      createdAt:
        originalExistingDoc?.createdAt ||
        new Date().toISOString(),

      // modifiedAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      syncedDocuments[existingIndex] = syncedUserDoc;
    } else {
      syncedDocuments.push(syncedUserDoc);
    }
  });

  return syncedDocuments;
}

function buildDraftFromPCGData(pcgData: any): CareTeamFaceSheetDraft {
  const existingFaceSheetDocuments = pcgData?.facesheet?.documents || {};
  const userDocuments = pcgData?.documents ?? [];

  const buildSyncedFaceSheetDoc = (docType: CareTeamFaceSheetDocType) => {
    const faceSheetDoc = existingFaceSheetDocuments?.[docType];

    if (faceSheetDoc?.fileUrl && faceSheetDoc?.status !== "remove") {
      return {
        ...faceSheetDoc,
        status: "existing",
      };
    }

    const mappedName = CARE_TEAM_DOC_SYNC_MAP[docType].documentName;
    const userDoc = findUserDocumentByName(userDocuments, mappedName);

    if (userDoc?.documentUrl) {
      return convertUserDocToFaceSheetDoc(userDoc);
    }

    return { status: "empty" };
  };

  return {
    name: safeStr(pcgData?.name || pcgData?.facesheet?.name),
    email: pcgData?.email,
    mobile: pcgData?.mobile || pcgData?.phone,

    emergencyContactName: safeStr(
      pcgData?.facesheet?.emergencyContactName ||
        pcgData?.biography?.personalDetails?.emergencyContactName,
    ),

    emergencyContactRelationship: safeStr(
      pcgData?.facesheet?.emergencyContactRelationship,
    ),

    emergencyContactPhone: safeStr(
      pcgData?.facesheet?.emergencyContactPhone ||
        pcgData?.biography?.personalDetails?.emergencyContactNumber,
    ),

    backgroundCheck:
      (pcgData?.facesheet
        ?.backgroundCheck as CareTeamFaceSheetDraft["backgroundCheck"]) ||
      "Not on file",

    tbTest:
      (pcgData?.facesheet?.tbTest as CareTeamFaceSheetDraft["tbTest"]) ||
      "Not on file",

    documents: {
      backgroundCheck: buildSyncedFaceSheetDoc("backgroundCheck"),
      tbTestResult: buildSyncedFaceSheetDoc("tbTestResult"),
      drivingLicense: buildSyncedFaceSheetDoc("drivingLicense"),
      cprCertificate: buildSyncedFaceSheetDoc("cprCertificate"),
    },
  };
}

function buildUpdatePayload(pcgData: any, draft: CareTeamFaceSheetDraft) {
  const { firstName, lastName } = splitName(draft.name);

  const oldDocuments = pcgData?.facesheet?.documents || {};
  const newDocuments = draft.documents || {};

  const removedDocumentTypes = Object.keys(oldDocuments).filter(
    (docType) => !(docType in newDocuments),
  );

  const facesheetData = {
    ...draft,
    documents: {
      ...newDocuments,
      ...removedDocumentTypes.reduce((acc, docType) => {
        acc[docType] = undefined;
        return acc;
      }, {} as any),
    },
  };

  const syncedUserDocuments = syncFaceSheetDocsToUserDocuments(
    pcgData,
    newDocuments,
  );

  const patch = {
    name: draft.name,
    firstName,
    lastName,
    email: draft?.email,
    mobile: draft?.mobile,

    documents: syncedUserDocuments,

    facesheet: facesheetData,

    biography: {
      personalDetails: {
        ...(pcgData?.biography?.personalDetails ?? {}),
        emergencyContactName:
          draft.emergencyContactName ||
          pcgData?.biography?.personalDetails?.emergencyContactName,
        emergencyContactNumber:
          draft.emergencyContactPhone ||
          pcgData?.biography?.personalDetails?.emergencyContactNumber,
      },
    },
  };

  const cleanedPatch = removeEmptyValuesDeep(patch);
  const result = deepMerge(pcgData, cleanedPatch);

  result.documents = syncedUserDocuments;

  result.facesheet = {
    ...(result.facesheet ?? {}),
    ...(cleanedPatch.facesheet ?? {}),
    documents: draft.documents ?? {},
  };

  return result;
}

const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

const CareTeamFaceSheet = ({ pcgID }: { pcgID: string }) => {
  const tokenRole = getUserRoleFromToken();
  const providerRole = useContext(RoleContext)?.role;
  const contextRole = tokenRole ?? providerRole;
  const faceSheetRef = useRef<HTMLDivElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const homeId = getHomeIdFromToken();
  const { mutate } = useUpdate();

  const dispatch = useDispatch();

  const {
    data: pcgData,
    isLoading,
    error,
  } = useGetById({
    key: "userId",
    payload: { id: pcgID, path: UserPath, enabled: !!pcgID },
  });

  const initialDraft = useMemo(
    () => buildDraftFromPCGData(pcgData),
    [pcgData],
  );

  const canEdit = hasAccess(
    contextRole as Role,
    "CARE_TEAM_FACE_SHEET",
    "EDIT",
  );

  const validationResult = careTeamFaceSheetBaseSchema.safeParse(initialDraft);
  if (!validationResult.success) {
    console.log("Validation errors:", validationResult.error.format());
  }

  const printFaceSheetOnly = () => {
    if (!faceSheetRef.current) return;

    const printContents = faceSheetRef.current.innerHTML;
    const originalContents = document.body.innerHTML;
    const headHtml = document.head.innerHTML;

    document.body.innerHTML = `
      <html>
        <head>${headHtml}</head>
        <body>
          <div style="padding:16px">${printContents}</div>
        </body>
      </html>
    `;

    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  const {
    values: draft,
    setFieldValue,
    setMultipleValues,
    validateForm,
    resetForm,
    markCurrentAsClean,
    isDirty,
    bindField,
    errors,
    touched,
    touchField,
  } = useZodForm({
    schema: careTeamFaceSheetBaseSchema as any,
    initialValues: initialDraft,
  });

  useEffect(() => {
    resetForm(initialDraft);
  }, [initialDraft]);

  const DOC_TYPES = FACESHEET_DOC_TYPES;
  type DocType = (typeof DOC_TYPES)[number];

  const nameField = bindField("name");
  const mobileField = bindField("mobile");
  const tbTestField = bindField("tbTest");
  const backgroundCheckField = bindField("backgroundCheck");

  const handleViewFile = async (documentUrl?: string) => {
    if (!documentUrl) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("No file found."));
      return;
    }

    try {
      const url = await fetchPreSignedUrl(documentUrl);
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

  const applyDocumentSideEffects = async () => {
    const updatedDocs: any = { ...(draft.documents ?? {}) };

    for (const docType of CARE_TEAM_FACESHEET_DOC_TYPES) {
      const doc = updatedDocs[docType];

      const normalizedDocumentName =
        CARE_TEAM_DOC_SYNC_MAP[docType as CareTeamFaceSheetDocType]
          .documentName;

      const s3Path = `${homeId}/${pcgData?.userId}/${normalizedDocumentName}`;

      if (doc?.status === "new" && doc?.file) {
        const uploadedUrl = await uploadToS3(doc.file, s3Path, bucketName!);

        updatedDocs[docType] = {
          fileUrl: uploadedUrl,
          fileName: doc.file.name,
          fileSize: doc.file.size,
          uploadedAt: new Date().toISOString(),
          status: "existing",
        };
      }

      if (doc?.status === "remove") {
        await deleteFromS3(normalizedDocumentName, s3Path, bucketName!);
        delete updatedDocs[docType];
      }

      if (doc?.status === "empty") {
        delete updatedDocs[docType];
      }
    }

    return updatedDocs;
  };

  const handleFileSizeError = (errorMessage: string) => {
    dispatch(handleOpenPopover());
    dispatch(handleShowCloseOptions());
    dispatch(handleShowPopoverMessage(errorMessage));
  };

  const stageDocumentUpload = (
    documentType:
      | "backgroundCheck"
      | "tbTestResult"
      | "drivingLicense"
      | "cprCertificate",
    file: File,
  ) => {
    setMultipleValues({
      documents: {
        ...(draft.documents ?? {}),
        [documentType]: {
          ...(draft.documents?.[documentType] ?? { status: "empty" }),
          file,
          status: "new",
        },
      },
    });
  };

  const stageDocumentRemove = (
    documentType:
      | "backgroundCheck"
      | "tbTestResult"
      | "drivingLicense"
      | "cprCertificate",
  ) => {
    const current = draft.documents?.[documentType];

    if (current?.status === "new") {
      setMultipleValues({
        documents: {
          ...(draft.documents ?? {}),
          [documentType]: { status: "empty" },
        },
      });
      return;
    }

    if (current?.fileUrl) {
      setMultipleValues({
        documents: {
          ...(draft.documents ?? {}),
          [documentType]: {
            ...current,
            status: "remove",
          },
        },
      });
      return;
    }

    setMultipleValues({
      documents: {
        ...(draft.documents ?? {}),
        [documentType]: { status: "empty" },
      },
    });
  };

  const stageUndoRemove = (
    documentType:
      | "backgroundCheck"
      | "tbTestResult"
      | "drivingLicense"
      | "cprCertificate",
  ) => {
    const cur = draft.documents?.[documentType];
    if (!cur) return;

    if (cur?.fileUrl) {
      setMultipleValues({
        documents: {
          ...(draft.documents ?? {}),
          [documentType]: { ...cur, status: "existing" },
        },
      });
    } else {
      setMultipleValues({
        documents: {
          ...(draft.documents ?? {}),
          [documentType]: { status: "empty" },
        },
      });
    }
  };

  const onSave = async () => {
    if (!isDirty) return;

    const isValid = validateForm();
    if (!isValid) return;

    setIsSaving(true);

    try {
      const finalDocs = await applyDocumentSideEffects();

      const draftForSave = {
        ...draft,
        documents: finalDocs,
      };

      const payload = buildUpdatePayload(pcgData, draftForSave);

      console.log("web facesheet payload documents", payload.documents);
      console.log(
        "CLINICAL_USER_PATH_OMIT_FIELDS",
        CLINICAL_USER_PATH_OMIT_FIELDS,
      );

      const finalPayload = {
        data: omit(payload, CLINICAL_USER_PATH_OMIT_FIELDS),
        path: UserPath,
      };


      mutate(finalPayload, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("FaceSheet updated successfully"));
          markCurrentAsClean();
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              error?.response?.data?.message ||
                "Error in updating user details",
            ),
          );
        },
      });
    } catch (e) {
      console.error("Save FaceSheet failed:", e);
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Error in updating user details"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 bg-white">
        <div className="text-sm text-gray-500">Loading FaceSheet...</div>
      </div>
    );
  }

  if (error || !pcgData) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 bg-white">
        <div className="text-sm text-red-500">
          Unable to load FaceSheet details.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto p-4 space-y-8 bg-white print:p-0 print:m-0">
      <div className="flex justify-end mb-3 print:hidden">
        <Button name="Print Face Sheet" buttonClick={printFaceSheetOnly} />
      </div>

      <div
        ref={faceSheetRef}
        className={`
          w-full max-w-xl mx-auto p-4 space-y-8 bg-white print:p-0 print:m-0
          ${!canEdit ? "pointer-events-none select-none opacity-95" : ""}
        `}
      >
        <Card className="p-6">
          <div className="flex items-center gap-5">
            <Avatar
              src={pcgData?.profileImageUrl}
              name={pcgData?.name}
              size={100}
              variant="bordered"
              alt="Senior Profile"
              className="!font-medium"
            />

            <div className="flex-1">
              <div className="text-xl font-extrabold text-gray-900 leading-tight">
                <InlineInput
                  value={toTitleCase(String(nameField.value ?? ""))}
                  onChange={(v) => nameField.onChange(v)}
                  onBlur={nameField.onBlur}
                  error={nameField.error}
                  placeholder="Name"
                  className="text-xl font-extrabold leading-tight"
                />
              </div>
              <div className="flex-1">{pcgData?.role}</div>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Contact Information" />
          <div className="flex-row mt-1 ml-6 text-sm text-gray-500">
            <div className="flex">
              <span className="text-sm text-gray-400 font-medium pt-[2px]">
                Email:
              </span>
              <div>{pcgData?.email}</div>
            </div>

            <div className="flex justify-end">
              <span className="text-sm text-gray-400 font-medium pt-[2px]">
                Mobile:
              </span>
              <InlineInput
                type="number"
                value={mobileField?.value ?? ""}
                onChange={(v) => mobileField.onChange(v)}
                onBlur={mobileField.onBlur}
                error={mobileField.error}
                placeholder="Phone"
                className="text-sm font-medium leading-tight"
              />
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Emergency contacts" />
          <div className="mt-6">
            <ContactBlock
              title="Primary"
              name={draft.emergencyContactName}
              relationship={draft.emergencyContactRelationship}
              phone={draft.emergencyContactPhone}
              errors={{
                name: touched.emergencyContactName
                  ? errors.emergencyContactName || ""
                  : "",
                relationship: touched.emergencyContactRelationship
                  ? errors.emergencyContactRelationship || ""
                  : "",
                phone: touched.emergencyContactPhone
                  ? errors.emergencyContactPhone || ""
                  : "",
              }}
              onBlur={(field) => {
                if (field === "name") touchField("emergencyContactName");
                if (field === "relationship") {
                  touchField("emergencyContactRelationship");
                }
                if (field === "phone") touchField("emergencyContactPhone");
              }}
              onChange={(patch) =>
                setMultipleValues({
                  emergencyContactName:
                    patch.name ?? draft.emergencyContactName,
                  emergencyContactRelationship:
                    patch.relationship ?? draft.emergencyContactRelationship,
                  emergencyContactPhone:
                    patch.phone ?? draft.emergencyContactPhone,
                })
              }
              divider={false}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Compliance Summary" />

          <Row label="Background Check">
            <InlineSelect
              value={String(backgroundCheckField.value ?? "")}
              onChange={(v) =>
                backgroundCheckField.onChange(v as FaceSheetDraft["dnr"])
              }
              onBlur={backgroundCheckField.onBlur}
              error={backgroundCheckField.error}
              options={[
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
                { label: "Not on file", value: "Not on file" },
              ]}
              className="text-right"
            />
          </Row>

          <Row label="TB Test">
            <InlineSelect
              value={String(tbTestField.value ?? "")}
              onChange={(v) => tbTestField.onChange(v as FaceSheetDraft["dnr"])}
              onBlur={tbTestField.onBlur}
              error={tbTestField.error}
              options={[
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
                { label: "Not on file", value: "Not on file" },
              ]}
              className="text-right"
            />
          </Row>
        </Card>

        <Card>
          <SectionTitle title="Compliance Documents" />

          <div className="mt-6">
            <UploadRow
              label="Background Check"
              disabled={!canEdit}
              doc={draft.documents?.backgroundCheck}
              onView={() =>
                handleViewFile(draft.documents?.backgroundCheck?.fileUrl)
              }
              onPickFile={(file) =>
                stageDocumentUpload("backgroundCheck", file)
              }
              onRemove={() => stageDocumentRemove("backgroundCheck")}
              onUndo={() => stageUndoRemove("backgroundCheck")}
              onFileSizeError={handleFileSizeError}
            />

            <UploadRow
              label="TB Test Results"
              disabled={!canEdit}
              doc={draft.documents?.tbTestResult}
              onView={() =>
                handleViewFile(draft.documents?.tbTestResult?.fileUrl)
              }
              onPickFile={(file) => stageDocumentUpload("tbTestResult", file)}
              onRemove={() => stageDocumentRemove("tbTestResult")}
              onUndo={() => stageUndoRemove("tbTestResult")}
              onFileSizeError={handleFileSizeError}
            />

            <UploadRow
              label="Driving License"
              disabled={!canEdit}
              doc={draft.documents?.drivingLicense}
              onView={() =>
                handleViewFile(draft.documents?.drivingLicense?.fileUrl)
              }
              onPickFile={(file) => stageDocumentUpload("drivingLicense", file)}
              onRemove={() => stageDocumentRemove("drivingLicense")}
              onUndo={() => stageUndoRemove("drivingLicense")}
              onFileSizeError={handleFileSizeError}
            />

            <UploadRow
              label="CPR Certificates"
              disabled={!canEdit}
              doc={draft.documents?.cprCertificate}
              onView={() =>
                handleViewFile(draft.documents?.cprCertificate?.fileUrl)
              }
              onPickFile={(file) => stageDocumentUpload("cprCertificate", file)}
              onRemove={() => stageDocumentRemove("cprCertificate")}
              onUndo={() => stageUndoRemove("cprCertificate")}
              onFileSizeError={handleFileSizeError}
            />
          </div>
        </Card>
      </div>

      {isDirty ? (
        <div className="sticky bottom-4 z-10 print:hidden">
          <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white shadow-md px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">Unsaved changes</div>
            <Button
              type="button"
              name={isSaving ? "Saving..." : "Save"}
              buttonClick={onSave}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CareTeamFaceSheet;