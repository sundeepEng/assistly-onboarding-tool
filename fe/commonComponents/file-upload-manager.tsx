"use client";
import React, { useEffect, useState } from "react";
import {
  Upload as FiUpload,
  CheckCircle,
  AlertCircle,
  Trash as FiTrash,
  Eye as FiEye,
} from "lucide-react";
import Button from "./button";
import InputFieldComponent from "./input-field-component";
import CommonModal from "./common-modal";
import { DocumentType, UserPath } from "../utils/constants";
import useGetById from "../services/getById";
import { CheckValidityOfDocument } from "../utils/checkValidityOfDocument";
import clsx from "clsx";
import { dateFormat } from "../utils/dateUtils";

export interface UploadedFile {
  documentCategory?: string;
  id?: string;
  uploadDate: any;
  documentId: string;
  expirationDate?: Date | any;
  url?: string;
  uploadedBy: string;
  file?: File;
  fileName?: string;
  documentName?: string;
}

interface FileUploadManagerProps {
  documentTypes: DocumentType[];
  initialFiles?: UploadedFile[];
  onUpload?: (file: UploadedFile) => void;
  onDelete?: (file: UploadedFile) => void;
  onView?: (file: UploadedFile) => void;
  cardItemsContainerClassName?: string;
}

export default function FileUploadManager({
  documentTypes,
  initialFiles = [],
  onUpload,
  onDelete,
  onView,
  cardItemsContainerClassName = "",
}: FileUploadManagerProps) {
  const [uploadedFiles, setUploadedFiles] =
    useState<UploadedFile[]>(initialFiles);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [currentDocumentId, setCurrentDocumentId] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setUploadedFiles(initialFiles);
  }, [initialFiles]);

  const requiredDocuments = documentTypes.filter((doc) => doc.required);
  const uploadedRequiredCount = requiredDocuments.filter((doc) =>
    uploadedFiles.some((file) => file.documentName === doc.name),
  ).length;

  const handleDirectUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    documentName: string,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload?.({
        documentName: documentName,
        file,
        fileName: file.name,
        expirationDate: "",
        uploadedBy: "",
        id: "",
        uploadDate: undefined,
        documentId: "",
      });
      event.target.value = "";
    }
  };
  const handleOpenExpirationModal = (documentId: string) => {
    setCurrentDocumentId(documentId);
    setIsModalOpen(true);
  };

  const handleModalFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setSelectedFile(event.target.files?.[0] || null);
  };

  const handleModalUpload = async () => {
    setUploading(true);
    if (selectedFile && currentDocumentId) {
      await onUpload?.({
        documentName: currentDocumentId,
        documentId: currentDocumentId,
        file: selectedFile,
        fileName: selectedFile.name,
        expirationDate,
        uploadedBy: "",
        id: "",
        uploadDate: undefined,
      });

      setSelectedFile(null);
      setExpirationDate("");
      setCurrentDocumentId("");
      setIsModalOpen(false);
      setUploading(false);
    }
  };

  const handleViewFile = (file: UploadedFile) => {
    if (onView) {
      onView(file);
    } else if (file.url) {
      window.open(file.url, "_blank");
    }
  };

  const isFileExpired = (file: UploadedFile) =>
    file.expirationDate && new Date() > file.expirationDate;

  const getUploadedFile = (docName: string) => {
    return uploadedFiles.find((file) => file.documentName === docName);
  };

  return (
    <div className=" mx-auto font-poppins ">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Document Management
        </h1>
        <div className="flex flex-col items-end gap-2">
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden bg-[#e2e8f0]">
            <div
              className="h-full bg-green-600 transition-all duration-300"
              style={{
                width: `${(uploadedRequiredCount / requiredDocuments.length) * 100
                  }%`,
              }}
            ></div>
          </div>
          <div className="text-sm text-gray-900">
            {uploadedRequiredCount} of {requiredDocuments.length} required
            uploaded
          </div>
        </div>
      </div>

      <div className={`flex flex-wrap gap-4 ${cardItemsContainerClassName}`}>
        {documentTypes.map((document) => {
          const uploadedFile = getUploadedFile(document.name);
          const isUploaded = !!uploadedFile;
          const isExpired = uploadedFile ? isFileExpired(uploadedFile) : false;
          const { data } = useGetById({
            key: "userId",
            payload: {
              id: uploadedFile?.uploadedBy,
              path: UserPath,
              enabled: !!uploadedFile?.uploadedBy,
            },
          });
          let expirationMessage;
          if (isUploaded) {
            expirationMessage = CheckValidityOfDocument({
              alertPeriodInDays: document?.alertPeriodInDays,
              expirationDate: getUploadedFile(document.name)?.expirationDate,
            });
          }
          return (
            <div
              key={document.id}
              className={clsx(
                `flex flex-col bg-white border-[2px] border-solid border-[#D1D5DB] rounded-lg p-4 w-[350px] hover:shadow-md transition-shadow ${expirationMessage?.border}`,
              )}
            >
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium text-gray-900">
                  {document.name}{" "}
                  {document.required && <span className="text-red-500">*</span>}
                </div>
                <div
                  className={`flex items-center gap-2 ${isUploaded && !isExpired ? "text-green-600" : "text-red-600"
                    } ${expirationMessage && `${expirationMessage.color}`}`}
                >
                  {isUploaded && !isExpired && !expirationMessage ? (
                    <CheckCircle />
                  ) : (
                    <AlertCircle
                      className={
                        expirationMessage && `${expirationMessage.color}`
                      }
                    />
                  )}
                </div>
              </div>

              {isUploaded ? (
                <div className="text-xs text-gray-600 mt-4 h-full">
                  <div className="flex flex-col justify-between h-full">
                    <div className="text-[14px]">
                      <p className="m-0">Uploaded by: {data && data?.name}</p>
                      <p className="m-0">
                        Date: {uploadedFile.uploadDate.toLocaleDateString()}
                      </p>
                      {uploadedFile.expirationDate && (
                        <p className={`m-0 ${expirationMessage?.color}`}>
                          Expires: {dateFormat(uploadedFile?.expirationDate)}
                        </p>
                      )}
                    </div>
                    {expirationMessage && (
                      <div
                        className={` text-[14px] ${expirationMessage.color}`}
                      >
                        {expirationMessage.message}
                      </div>
                    )}
                    <div className="flex justify-between mt-4">
                      <div
                        onClick={() => handleViewFile(uploadedFile)}
                        className="flex items-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg cursor-pointer"
                      >
                        <FiEye /> View
                      </div>
                      <div
                        onClick={() => onDelete(uploadedFile)}
                        className="flex items-center gap-2 px-3 py-2 border-[1px] border-solid border-[#D1D5DB] rounded-lg cursor-pointer"
                      >
                        <FiTrash /> Delete
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-gray-300 border-2 border-dashed bg-gray-50 rounded-lg p-4 text-center cursor-pointer mt-4">

                  <div
                    className="flex flex-col items-center gap-2 text-gray-600"
                    onClick={(e) => handleOpenExpirationModal(document.name)}
                  >
                    <FiUpload size={24} />
                    <p className="text-sm">Click to upload</p>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expiration Modal */}
      <CommonModal
        modalOpen={isModalOpen}
        setModalOpen={setIsModalOpen}
        title="Upload File with Expiration"
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
              <>
                Expiration Date
              </>
            }
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            name=""
            max="9999-12-31"
          />


          <Button
            buttonClick={handleModalUpload}
            disabled={
              uploading ||
              !selectedFile
            }
            classname="w-full"
            name={
              uploading ? (
                "Uploading..."
              ) : (
                "Upload File"
              )
            }
            type="submit"
          />

        </div>
      </CommonModal>
    </div>
  );
}
