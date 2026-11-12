import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import Button from "../../../commonComponents/button";
import CommonModal from "../../../commonComponents/common-modal";
import AiLoader from "../../../commonComponents/ai-loader";
import { EmptyUploadCard } from "../../documents/documents-card";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import {
    setExtractionLoading,
    setExtractedMedications,
    setExtractionError,
    ExtractedMedication,
} from "../../../redux/slices/medication-extraction-slice";
import fetchPreSignedUrl from "../../../services/get-presigned-url";
import useUpdate from "../../../services/update";
import {
    MAX_FILE_SIZE_MB,
    MEDICATION_EXTRACTION_URL,
    MealToTimeMap,
    personalDocsOfPCGAllowedFormats,
    USER_PATH_OMIT_FIELDS,
    UserPath,
} from "../../../utils/constants";
import { uploadToS3 } from "../../../utils/uploadToS3";
import { omit } from "../../../utils/dateUtils";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../utils/auth";

interface BulkMedicationModalProps {
    seniorData: any;
    isOpen: boolean;
    onClose: () => void;
}

const BulkMedicationModal: React.FC<BulkMedicationModalProps> = ({
    seniorData,
    isOpen,
    onClose,
}) => {
    const dispatch = useAppDispatch();
    const { mutate } = useUpdate();
    const [isUploading, setIsUploading] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const homeId = getHomeIdFromToken();

    const { extractedDocumentUrls } = useAppSelector(
        (state: { medicationExtraction: { extractedDocumentUrls: string[] } }) =>
            state.medicationExtraction
    );

    // Find existing medication list document in senior's documents
    const medicationListDoc = seniorData?.documents?.find(
        (doc: any) =>
            doc?.documentName
                ?.toLowerCase()
                .replace(/[\s_\-().]+/g, "")
                .includes("medicationlist") && doc?.documentUrl
    );

    const isMedicationExtracted = !!(
        medicationListDoc?.documentUrl &&
        extractedDocumentUrls?.includes(medicationListDoc.documentUrl)
    );

    // Upload file to S3 and update senior's documents
    const handleUploadFile = async (file: File) => {
        if (!personalDocsOfPCGAllowedFormats[file.type]) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
                handleShowPopoverMessage(
                    "Invalid file format. Please upload a PDF, DOC, DOCX, JPG, or PNG file."
                )
            );
            return;
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
                handleShowPopoverMessage(
                    `File size exceeds ${MAX_FILE_SIZE_MB}MB. Please upload a smaller file.`
                )
            );
            return;
        }

        setIsUploading(true);

        try {
            const fileExtension =
                personalDocsOfPCGAllowedFormats[file.type] || "";
            const bucketUploadPath = `${homeId}/${seniorData?.userId}/medication_list${fileExtension}`;
            const bucketName =
                process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

            const uploadedFileUrl = await uploadToS3(
                file,
                bucketUploadPath,
                bucketName
            );

            if (!uploadedFileUrl) {
                throw new Error("Upload failed. Please try again.");
            }

            // Update senior's documents array
            const existingDocuments = seniorData?.documents || [];
            const existingIndex = existingDocuments.findIndex((doc: any) =>
                doc?.documentName
                    ?.toLowerCase()
                    .replace(/[\s_\-().]+/g, "")
                    .includes("medicationlist")
            );

            const newDoc = {
                documentId:
                    existingIndex >= 0
                        ? existingDocuments[existingIndex].documentId
                        : uuidv4(),
                documentType: personalDocsOfPCGAllowedFormats[file.type],
                documentName: "medication_list",
                documentUrl: uploadedFileUrl,
                createdByUserId: getUserIdFromToken() || "",
                createdAt: new Date().toISOString(),
                isRequiredDocument: false,
                documentCategory: "other",
            };

            let updatedDocuments;
            if (existingIndex >= 0) {
                updatedDocuments = [...existingDocuments];
                updatedDocuments[existingIndex] = {
                    ...updatedDocuments[existingIndex],
                    ...newDoc,
                };
            } else {
                updatedDocuments = [...existingDocuments, newDoc];
            }

            const userDataToUpdate = {
                ...seniorData,
                documents: updatedDocuments,
            };
            const cleanedData: any = omit(
                userDataToUpdate,
                USER_PATH_OMIT_FIELDS
            );
            const payload = { data: cleanedData, path: UserPath };

            mutate(payload, {
                onSuccess: () => {
                    dispatch(handleOpenPopover());
                    dispatch(
                        handleShowPopoverMessage(
                            "Medication list uploaded successfully!"
                        )
                    );
                    setIsUploading(false);
                    // Auto-extract after successful upload
                    handleExtractMedications(uploadedFileUrl);
                },
                onError: (error: any) => {
                    console.error("Mutation error:", error, error?.response?.data);
                    dispatch(handleOpenPopover());
                    dispatch(handleShowCloseOptions());
                    dispatch(
                        handleShowPopoverMessage(
                            error?.response?.data?.message || "Failed to save document. Please try again."
                        )
                    );
                    setIsUploading(false);
                },
            });
        } catch (error: any) {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
                handleShowPopoverMessage(
                    error.message || "Upload failed. Please try again."
                )
            );
            setIsUploading(false);
        }
    };

    // Extract medications from a document URL
    const handleExtractMedications = async (documentUrl: string) => {
        if (!documentUrl) return;

        setIsExtracting(true);
        dispatch(setExtractionLoading());

        try {
            const presignedUrl = await fetchPreSignedUrl(documentUrl);
            if (!presignedUrl) {
                throw new Error("Unable to access the uploaded document.");
            }

            const response = await fetch(MEDICATION_EXTRACTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileUrl: presignedUrl }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = "Failed to extract medications";
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorMessage;
                } catch {
                    // server returned a non-JSON error page
                }
                throw new Error(errorMessage);
            }

            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                throw new Error("Unexpected response from server. Please try again.");
            }

            const data = await response.json();

            if (!data.medications || data.medications.length === 0) {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(
                    handleShowPopoverMessage(
                        "No medications found. Please try a different file."
                    )
                );
                setIsExtracting(false);
                return;
            }

            const today = format(new Date(), "yyyy-MM-dd");

            const normalizeTimings = (timings: any[]): string[] => {
                return timings
                    .map((t: string) => {
                        const lower = t?.toLowerCase?.()?.trim();
                        if (MealToTimeMap[lower]) return MealToTimeMap[lower];
                        const match = t?.match?.(/^(\d{1,2}):(\d{2})$/);
                        if (match)
                            return `${match[1].padStart(2, "0")}:${match[2]}:00`;
                        if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
                        if (lower === "prn") return "07:00:00";
                        return null;
                    })
                    .filter((t): t is string => t !== null);
            };

            const mappedMeds: ExtractedMedication[] = data.medications
                .map((med: any) => ({
                    id: uuidv4(),
                    name: med.name || "",
                    dosage: med.dosage || "",
                    directions: med.directions || "",
                    startdate: med.startDate || today,
                    enddate: med.endDate || "",
                    timings: Array.isArray(med.timings)
                        ? normalizeTimings(med.timings)
                        : [],
                    additionalComments: "",
                }))
                .filter((med) => med.timings.length > 0);

            // Merge duplicates by medication name
            const mergedMap = new Map<string, ExtractedMedication>();
            for (const med of mappedMeds) {
                const key = med.name.trim().toLowerCase();
                if (!key) continue;
                if (mergedMap.has(key)) {
                    const existing = mergedMap.get(key)!;
                    existing.timings = [
                        ...new Set([...existing.timings, ...med.timings]),
                    ].sort();
                    if (med.directions.length > existing.directions.length)
                        existing.directions = med.directions;
                    if (!existing.dosage && med.dosage)
                        existing.dosage = med.dosage;
                    if (!existing.startdate && med.startdate)
                        existing.startdate = med.startdate;
                    if (!existing.enddate && med.enddate)
                        existing.enddate = med.enddate;
                } else {
                    mergedMap.set(key, { ...med });
                }
            }

            const extractedMeds = Array.from(mergedMap.values());
            dispatch(
                setExtractedMedications({
                    medications: extractedMeds,
                    seniorId: seniorData?.userId,
                    sourceDocumentUrl: documentUrl,
                })
            );

            dispatch(handleOpenPopover());
            dispatch(
                handleShowPopoverMessage(
                    `${extractedMeds.length} medication(s) extracted! Review them below.`
                )
            );
            onClose(); // Close modal — MedicationReviewModal opens via Redux
        } catch (error: any) {
            dispatch(setExtractionError(error.message));
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
                handleShowPopoverMessage(
                    error.message ||
                    "Failed to extract medications from the document."
                )
            );
        } finally {
            setIsExtracting(false);
        }
    };

    const isProcessing = isUploading || isExtracting;

    return (
        <CommonModal
            title="Bulk Medication Upload"
            modalOpen={isOpen}
            setModalOpen={onClose}
            titleClass="text-[24px] font-medium"
            crossCTA={!isProcessing}
            width="550px"
            className="py-4"
        >
            <div className="px-6 py-4">
                {isProcessing ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <AiLoader
                            message={
                                isUploading
                                    ? "Uploading document..."
                                    : "Extracting medications..."
                            }
                            subtitle="This may take a few seconds"
                        />
                    </div>
                ) : medicationListDoc ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-full p-4 border border-gray-200 rounded-lg bg-gray-50 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary bg-opacity-10 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                    {medicationListDoc.documentName ||
                                        "Medication List"}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {medicationListDoc.createdAt
                                        ? `Uploaded ${new Date(
                                            medicationListDoc.createdAt
                                        ).toLocaleDateString()}`
                                        : "Document uploaded"}
                                </p>
                            </div>
                        </div>
                        <Button
                            disabled={isMedicationExtracted}
                            name={
                                isMedicationExtracted
                                    ? "Medications Already Extracted"
                                    : "Add Bulk Medications"
                            }
                            buttonClick={() =>
                                handleExtractMedications(
                                    medicationListDoc.documentUrl
                                )
                            }
                            icon={<FileText size={16} />}
                            classname="!text-white"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 py-4">
                        <p className="text-base font-semibold text-gray-800 mb-1">
                            No Medication List Found
                        </p>
                        <p className="text-sm text-gray-500 text-center">
                            Please upload a medication list document to extract medications.
                        </p>
                        <EmptyUploadCard onUpload={handleUploadFile} />
                    </div>
                )}
            </div>
        </CommonModal>
    );
};

export default BulkMedicationModal;
