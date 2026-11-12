import _ from "lodash";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import useGetById from "../../services/getById";
import useUpdate from "../../services/update";
import {
  USER_PATH_OMIT_FIELDS,
  UserPath,
  documentRequiredForNurse,
  homePath,
  onboardingDocsForNurse,
  personalDocsOfNurseAllowedFormats,
  userRoles,
} from "../../utils/constants";
import { omit } from "../../utils/dateUtils";
import { deleteFromS3 } from "../../utils/uploadToS3";
import { RoleContext } from "../role-provider";
import Documents from "../documents/documents-card";
import { isDocumentRequired } from "../../utils/documentUtils";
import { getHomeIdFromToken, getUserIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import { ProtectedComponent } from "../protectedComponent";
import { Role } from "../../utils/roles";

interface UploadedFile {
  fileUrl: string;
  documentType: string;
  documentName: string;
  documentExpiryDateRequired?: string;
}

// Nurse actions/details view.
// This mirrors PCG actions: shows required documents (single Nurse doc) + additional uploaded docs.
const NurseActions: NextPage<any> = ({ nurseID }: { nurseID: string }) => {
  // Loads nurse lead / nurse user data.
  const { data: leadData } = useGetById({
    key: "user",
    payload: { id: nurseID, path: UserPath, enabled: !!nurseID },
  });

  const dispatch = useAppDispatch();
  const { mutate } = useUpdate();
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const router = useRouter();

  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);

  const homeId = getHomeIdFromToken();

  // Loads home data (needed for S3 paths).
  const { data: homeData } = useGetById({
    key: "home-data",
    payload: { id: homeId, path: homePath, enabled: !!homeId },
  });

  // Sync role from context/cookies.
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole, router]);

  // Called when a nurse uploads one or more documents.
  // We append new documents to the user's existing `documents` array.
  const handleUploadComplete = (newFiles: UploadedFile[]) => {
    const userId = getUserIdFromToken();
    if (!userId) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Not able to upload Files, please try again"));
      return;
    }

    const uploadedDocuments = newFiles.map((file) => ({
      documentId: uuidv4(),
      documentType: personalDocsOfNurseAllowedFormats[file.documentType],
      documentName: file.documentName,
      documentUrl: file.fileUrl,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
      isRequiredDocument: isDocumentRequired(file.documentName, documentRequiredForNurse) || false,
      documentCategory: "other",
      documentExpiryDate: file.documentExpiryDateRequired && file.documentExpiryDateRequired,
    }));

    if (uploadedDocuments.length > 0) {
      const existingDocuments = _.get(leadData, "documents", []);
      const updatedDocuments = [...existingDocuments, ...uploadedDocuments];

      const userDataToUpdate = {
        ...leadData,
        documents: updatedDocuments,
      };

      const cleanedData: any = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);
      const payload = { data: cleanedData, path: UserPath };

      mutate(payload, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Files Uploaded Successfully!"));
        },
        onError: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(handleShowPopoverMessage("Not able to upload Files, please try again"));
        },
      });
    }
  };

  // Deletes a document from S3 and removes it from the user's `documents` array.
  const handleDelete = async (document: any) => {
    const fileName = document?.documentUrl?.split("/").pop();
    if (!fileName) return;

    const bucketUploadPath = `${homeId}/${leadData?.userId}/${fileName}`;
    const bucketName =
      document?.documentCategory === "onboarding"
        ? process.env.NEXT_PUBLIC_AWS_MODIFIED_CONTRACTS_BUCKET_NAME
        : process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

    setDeletingFile(document?.documentUrl);

    const success: any = await deleteFromS3(
      fileName,
      bucketUploadPath,
      bucketName,
    );

    if (success) {
      const updatedDocuments = leadData?.documents?.filter(
        (doc) => doc?.documentId !== document?.documentId,
      );

      const userDataToUpdate = {
        ...leadData,
        documents: updatedDocuments,
      };

      const cleanedData: any = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);
      const payload = { data: cleanedData, path: UserPath };

      mutate(payload, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("File Deleted Successfully!"));
        },
        onError: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(handleShowPopoverMessage("Not able to delete File, please try again"));
        },
      });
    }

    setDeletingFile(null);
  };

  const normalize = (str: string) =>
    str?.toLowerCase().replace(/[\s_\-().]+/g, "");

  // Splits the backend docs into:
  // 1) main (required) docs: driven by `documentRequiredForNurse` (single required document)
  // 2) additional docs: everything else the user uploaded
  const normalizeDocuments = (leadDocs = []) => {
    let baseDocs = documentRequiredForNurse;

    const onboardingCompleted =
      leadData?.docusignEnvelopeStatus === "completed" ||
      leadData?.onboardingESignEnvelopeStatus === "completed";

    // Hide onboarding docs from non-PCHO viewers if onboarding isn't completed.
    if (role !== userRoles.PCHO && !onboardingCompleted) {
      baseDocs = baseDocs?.filter(
        (doc) => !onboardingDocsForNurse.includes(doc?.name),
      );
    }

    const documents: any[] = baseDocs.map((doc) => {
      const matchedDoc = leadDocs?.find((apiDoc) =>
        normalize(apiDoc.documentName).includes(normalize(doc.name)),
      );

      const inferredCategory = onboardingDocsForNurse.includes(doc.name)
        ? "onboarding"
        : "other";

      const documentCategory = matchedDoc?.documentCategory || inferredCategory;

      return {
        documentName: doc?.name,
        documentType: matchedDoc?.documentType || null,
        documentUrl: matchedDoc?.documentUrl || null,
        required: doc.required,
        status: matchedDoc ? "Uploaded" : "Missing",
        createdAt: matchedDoc?.createdAt || null,
        createdByUserId: matchedDoc?.createdByUserId || null,
        documentId: matchedDoc?.documentId || uuidv4(),
        documentLabel: doc?.label,
        documentCategory,
        documentExpiryDateRequired: (doc as any)?.expiryDate || false,
        documentExpiryDate: matchedDoc?.documentExpiryDate || null,
        alertPeriodInDays: (doc as any)?.alertPeriodInDays || null,
        documentTemplateId: (doc as any)?.templateId || null,
        documentValues: matchedDoc?.documentValues || null,
        documentStatus: matchedDoc?.documentStatus || null,
      };
    });

    const additionalDocuments: any[] = leadDocs
      ?.filter((apiDoc) => {
        const apiDocNameNormalized = normalize(apiDoc?.documentName);
        return !documentRequiredForNurse.some((doc) =>
          apiDocNameNormalized.includes(normalize(doc?.name)),
        );
      })
      ?.map((apiDoc) => ({
        documentName: apiDoc?.documentName,
        documentType: apiDoc?.documentType || null,
        documentUrl: apiDoc?.documentUrl || null,
        required: false,
        status: "Uploaded",
        createdAt: apiDoc?.createdAt || null,
        createdByUserId: apiDoc?.createdByUserId || null,
        documentId: apiDoc?.documentId || uuidv4(),
        documentLabel: apiDoc?.documentName,
        documentCategory: apiDoc?.documentCategory || "other",
        documentValues: apiDoc?.documentValues || null,
        documentStatus: apiDoc?.documentStatus || null,
      }));

    return { documents, additionalDocuments };
  };

  const { documents: mainDocuments, additionalDocuments: otherDocuments } =
    normalizeDocuments(leadData?.documents);

  return (
    <div className={`p-2 space-y-6 `}>
      <div className={`container `}>
        <ProtectedComponent
          role={role as Role}
          feature="CARE_LEAD_NAME"
          access="EDIT"
        >
          <p className="text-heading font-bold font-jakarta m-0">
            {leadData?.role == userRoles.NURSELEAD ? "Nurse Lead" : "Nurse"} -{" "}
            {leadData?.name}
          </p>
        </ProtectedComponent>

        <Documents
          documents={mainDocuments}
          additionalDocuments={otherDocuments}
          onDelete={handleDelete}
          leadData={leadData}
          onUploadComplete={handleUploadComplete}
          deleted={leadData?.isDeleted}
        />
      </div>
    </div>
  );
};

export default NurseActions;
