import _ from "lodash";
import { useRouter } from "next/router";
import { useContext, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import Comments from "../commonComponents/comments/comments";
import { useAppDispatch } from "../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import fetchPreSignedUrl from "../services/get-presigned-url";
import useUpdate from "../services/update";
import {
  UserPath,
  userRoles,
  personalDocsOfPCGAllowedFormats,
  USER_PATH_OMIT_FIELDS,
  documentRequiredForSenior,
  onboardingDocsForSeniors,
} from "../utils/constants";
import { omit } from "../utils/dateUtils";
import { deleteFromS3 } from "../utils/uploadToS3";
import { RoleContext } from "./role-provider";
import Documents from "./documents/documents-card";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../utils/auth";
interface UploadedFile {
  fileUrl: string;
  documentType: string;
  documentName: string;
}

interface UploadedFileTypes {
  documentId: string;
  documentType: string;
  documentName: string;
  documentUrl: string;
  createdByUserId: string;
  createdAt: string;
}

interface DocumentItem {
  documentId: string;
  documentName: string;
  status: "Uploaded" | "Missing";
  file?: File;
  createdByUserId?: any;
  createdAt?: string;
  required?: boolean;
  type?: string;
}

export default function Actions({ leadData }: any) {
  const { mutate } = useUpdate();
  const dispatch = useAppDispatch();
  const homeId = getHomeIdFromToken();
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const handleUploadComplete = (newFiles: UploadedFile[]) => {
    const userId = getUserIdFromToken();
    if (!userId) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Not able to upload Files, please try again"),
      );
      return;
    }

    const uploadedDocuments = newFiles.map((file: any) => ({
      documentId: uuidv4(),
      documentType:
        personalDocsOfPCGAllowedFormats[file.documentType] || file.documentType,
      documentName: file.documentName,
      documentUrl: file.fileUrl,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
      isRequiredDocument: file.isRequiredDocument ?? false,
      documentCategory: file.documentCategory || "other",
      documentExpiryDate:
        file.documentExpiryDate || file.documentExpiryDateRequired,
    }));

    if (uploadedDocuments.length > 0) {
      // Check if user already has documents
      const existingDocuments = _.get(leadData, "documents", []); // Get the documents array safely, default to an empty array
      const updatedDocuments = [...existingDocuments, ...uploadedDocuments]; // Combine old and new documents

      // Prepare data to mutate (append documents to the user object)
      const userDataToUpdate = {
        ...leadData,
        documents: updatedDocuments, // Update documents array with new ones
      };
      // Filter out 'modifiedAt' from the payload
      const cleanedData: any = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);
      // Prepare the payload and trigger mutation
      const payload = { data: cleanedData, path: UserPath };
      mutate(payload, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Files Uploaded Successfully!"));
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              "Not able to upload Files, please try again",
            ),
          );
        },
      });
    }
  };

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
      // Remove the document from leadData.documents using documentId
      const updatedDocuments = leadData?.documents?.filter(
        (doc) => doc?.documentId !== document?.documentId,
      );

      // Prepare the updated user data with the new documents array
      const userDataToUpdate = {
        ...leadData,
        documents: updatedDocuments, // Update documents array after deletion
      };
      // Filter out 'modifiedAt' from the payload
      const cleanedData: any = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);

      // Prepare the payload and trigger mutation
      const payload = { data: cleanedData, path: UserPath };
      // Call mutate function to update the user data
      mutate(payload, {
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
      });
    }
    setDeletingFile(null);
  };

  const handleSubmitComment = (updatedComments) => {
    if (!leadData.actions) {
      leadData.actions = { comments: [] };
    }
    leadData.actions.comments =
      updatedComments?.length > 0 ? updatedComments : leadData.actions.comments;

    const cleanedCareplanData: any = omit(leadData, USER_PATH_OMIT_FIELDS);
    const payload = { data: cleanedCareplanData, path: UserPath };
    mutate(payload, {
      onSuccess: () => {},
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(error?.response?.data?.message));
      },
    });
  };
  var role = useContext(RoleContext)?.role || getUserRoleFromToken();

  const normalize = (str: string) =>
    str?.toLowerCase().replace(/[\s_\-().]+/g, "");

  const normalizeDocuments = (leadDocs = []) => {
    const onboardingDocuments: any[] = leadDocs
      ?.filter((apiDoc: any) => apiDoc?.documentCategory === "onboarding")
      ?.sort((currentDocument: any, nextDocument: any) => {
        const currentDocumentIsPriority = onboardingDocsForSeniors?.some(
          (seniorOnboardingDocName: string) =>
            normalize(currentDocument?.documentName).includes(
              normalize(seniorOnboardingDocName),
            ),
        );

        const nextDocumentIsPriority = onboardingDocsForSeniors?.some(
          (seniorOnboardingDocName: string) =>
            normalize(nextDocument?.documentName).includes(
              normalize(seniorOnboardingDocName),
            ),
        );

        if (currentDocumentIsPriority && !nextDocumentIsPriority) return -1;
        if (!currentDocumentIsPriority && nextDocumentIsPriority) return 1;

        return 0;
      })
      ?.map((apiDoc: any) => ({
        documentName: apiDoc?.documentName,
        documentType: apiDoc?.documentType || null,
        documentUrl: apiDoc?.documentUrl || null,
        required: apiDoc?.isRequiredDocument || false,
        status: "Uploaded",
        createdAt: apiDoc?.createdAt || null,
        createdByUserId: apiDoc?.createdByUserId || null,
        documentId: apiDoc?.documentId || uuidv4(),
        documentLabel: apiDoc?.documentName,
        documentCategory: apiDoc?.documentCategory || "onboarding",
        documentTemplateId: apiDoc?.documentTemplateId || null,
        signedDocumentUrl: apiDoc?.signedDocumentUrl || [],
        expiryDate: apiDoc?.documentExpiryDate || null,
        alertPeriodInDays: apiDoc?.alertPeriodInDays || 30,
      }));

    // Build cards from baseDocs (empty if not uploaded, filled if matched)
    const baseDocCards: any[] = documentRequiredForSenior?.map((doc: any) => {
      const matchedDoc = leadDocs?.find(
        (apiDoc: any) =>
          normalize(apiDoc?.documentName) === normalize(doc.name),
      );

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
        documentCategory: matchedDoc?.documentCategory || "other",
        expiryDate: matchedDoc?.documentExpiryDate || null,
        alertPeriodInDays: doc?.alertPeriodInDays || 30,
      };
    });

    // Remaining uploaded docs that are NOT onboarding and NOT matched by baseDocs
    const remainingDocs: any[] = leadDocs
      ?.filter((apiDoc: any) => {
        if (apiDoc?.documentCategory === "onboarding") return false;
        const apiDocNorm = normalize(apiDoc?.documentName);
        return !documentRequiredForSenior.some(
          (doc: any) => apiDocNorm === normalize(doc.name),
        );
      })
      ?.map((apiDoc: any) => ({
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
        alertPeriodInDays: 30,
        expiryDate: apiDoc?.documentExpiryDate || null,
      }));

    // baseDocs cards first, then remaining uploaded docs
    const additionalDocuments = [...baseDocCards, ...remainingDocs];

    return { documents: onboardingDocuments, additionalDocuments };
  };

  const { documents: mainDocuments, additionalDocuments: otherDocuments } =
    normalizeDocuments(leadData?.documents);

  return (
    <div>
      <div className="bg-white rounded-[10px] border-2 border-solid border-[#E0E0E0]">
        <div className="container mx-auto p-6">
          <Documents
            documents={mainDocuments}
            additionalDocuments={otherDocuments}
            onDelete={handleDelete}
            leadData={leadData}
            onUploadComplete={handleUploadComplete}
          />
        </div>

        <div className="px-6 rounded-lg shadow">
          <Comments
            handleSubmitComment={handleSubmitComment}
            data={leadData?.actions?.comments}
          />
        </div>
      </div>
    </div>
  );
}
