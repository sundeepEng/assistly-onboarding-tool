import { useRouter } from "next/router";
import React, { useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import useUpsert from "../../services/upsert";
import { v4 as uuidv4 } from "uuid";
import useGetById from "../../services/getById";
import {
  ComplainceUploadTrainingAllowedTypes,
  homePath,
} from "../../utils/constants";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
  handleShowWarningMessage,
} from "../../redux/slices/exception-popover-slice";
import { uploadToS3 } from "../../utils/uploadToS3";
import Form from "../../commonComponents/form";
import { uploadTraningModule } from "../../model/home/home-model";
import { Card, CardContent } from "../../commonComponents/card";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import FormTextareaComponent from "../../commonComponents/form-textarea-component";
import FormSingleRadioSelect from "../../commonComponents/form-single-radio-select";
import { Upload } from "lucide-react";
import Button from "../../commonComponents/button";
import { getHomeIdFromToken, getUserIdFromToken } from "../../utils/auth";

const DURATION_OPTIONS = [
  { option: "6 Months", value: "180" },
  { option: "1 Year", value: "365" },
  // { option: "Custom", value: "custom" },
];

const CertificateDurationField = () => {
  const { watch } = useFormContext();
  const durationType = watch("certificateDurationType");

  return (
    <div className="space-y-2">
      <label className="text-base font-poppins">Certificate Expires In *</label>
      <FormSingleRadioSelect
        name="certificateDurationType"
        options={DURATION_OPTIONS}
      />
      {durationType === "custom" && (
        <FormInputFieldComponent
          label="Enter number of days"
          name="certificateDurationCustomDays"
          type="number"
          placeholder="Enter number of days"
          className="!max-w-[180px]"
        />
      )}
    </div>
  );
};

const CreateTrainingModule = () => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const { mutate } = useUpsert();
  const homeId = getHomeIdFromToken();
  const userId = getUserIdFromToken();

  // Get HOME by home id
  const { data: HomeData } = useGetById({
    key: "home",
    payload: { id: homeId, path: homePath,enabled:!!homeId },
  });
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (!files || files.length === 0) return;

    let videoFile = null;
    let pptFile = null;
    const validFiles = [];

    // Loop through selected files and separate them
    Object.values(files).forEach((file) => {
      const isValidMime = Object.keys(
        ComplainceUploadTrainingAllowedTypes
      ).includes(file.type);

      if (isValidMime) {
        if (file.type === "video/mp4" && !videoFile) {
          videoFile = file; // Only one .mp4 file
          validFiles.push(file);
        } else if (
          (file.type === "application/vnd.ms-powerpoint" ||
            file.type ===
              "application/vnd.openxmlformats-officedocument.presentationml.presentation") &&
          !pptFile
        ) {
          pptFile = file; // Only one .ppt file
          validFiles.push(file);
        }
      }
    });

    // Check if there are more than one file per type
    if (validFiles.length === 0) {
      dispatch(handleOpenPopover());
      dispatch(
        handleShowPopoverMessage("Please upload either a video or a PPT file")
      );
      dispatch(handleShowCloseOptions());
      dispatch(handleShowWarningMessage());
      return;
    }

    // If the number of valid files exceeds the allowed count, reject the extra ones
    if (validFiles.length > 2) {
      dispatch(handleOpenPopover());
      dispatch(
        handleShowPopoverMessage(
          "You can upload only one video and one PPT file"
        )
      );
      dispatch(handleShowCloseOptions());
      dispatch(handleShowWarningMessage());
      return;
    }

    // Create a new DataTransfer object to manage the selected files (acting like a FileList)
    const fileList = new DataTransfer();
    validFiles.forEach((file) => fileList.items.add(file));

    setSelectedFiles(fileList.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;

    // If no files are dragged or files is empty, return
    if (!files || files.length === 0) return;

    handleFileUpload({
      target: { files },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const handleModuleSubmit = async (data) => {
    setIsLoading(true);
    const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;
    // For File submission
    if (!selectedFiles) {
      setIsLoading(false);
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("Please upload a video"));
      dispatch(handleShowCloseOptions());
      dispatch(handleShowWarningMessage());
      return;
    }
    try {
      var homePayload = HomeData?.home;
      if (!homePayload?.complianceTraining) {
        homePayload = { ...homePayload, complianceTraining: [] };
      }
      const moduleId = uuidv4();
      const certificateDurationDays =
        data.certificateDurationType === "custom"
          ? data.certificateDurationCustomDays
          : Number(data.certificateDurationType);

      const moduleData = {
        moduleId: moduleId,
        moduleName: data?.moduleName,
        moduleDescription: data?.moduleDescription,
        certificateDurationDays,
        documents: [],
        createdByUserId: userId,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };
      const documentDataArray = await Promise.all(
        Object.values(selectedFiles).map(async (file, index) => {
          const documentType = `.${file.name.slice(
            file.name.lastIndexOf(".") + 1
          )}`;
          const documentName = `${data?.moduleName}_${
            documentType === ".mp4"
              ? "video"
              : (documentType === ".ppt" || documentType === ".pptx") && "ppt"
          }`;
          const uniqueFilename = `${homeId}/ComplianceTraining/${moduleId}/${documentName}`;
          const fileUrl = await uploadToS3(file, uniqueFilename, bucketName);
          return {
            documentId: uuidv4(),
            documentType,
            documentName: documentName,
            documentUrl: fileUrl,
            documentCreatedAt: new Date().toISOString(),
            documentCreatedByUserId: userId,
          };
        })
      );
      moduleData.documents = documentDataArray;
      homePayload.complianceTraining.push(moduleData);
      homePayload = {
        ...homePayload,
        modifiedAt: new Date().toISOString(),
      };
      const payload = { data: homePayload, path: homePath };
      mutate(payload, {
        onSuccess: () => {
          setIsLoading(false);
          dispatch(handleOpenPopover());
          dispatch(
            handleShowPopoverMessage("Training module uploaded succesfully!")
          );
          router.push(`/compliance/training`);
        },
        onError: (err: any) => {
          setIsLoading(false);
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage("Failed to upload training module")
          );
        },
      });
    } catch (error) {
      console.error("Error uploading profile video or text", error);
    }
  };
  return (
    <div>
      <Form onSubmit={handleModuleSubmit} schema={uploadTraningModule}>
        <div className="container mx-auto p-6 max-w-4xl space-y-6 font-poppins bg-[white]">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Create Training Module</h1>
              <p className="text-muted-foreground">
                Upload content and create a new training module
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card className="py-[10px]">
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <FormInputFieldComponent
                      label={"Module Title *"}
                      name={"moduleName"}
                      className="!max-w-[800px] !w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <FormTextareaComponent
                      label={"Description *"}
                      onChange={() => {}}
                      name={"moduleDescription"}
                      className="!max-w-[800px] !w-full"
                      placeholder="Describe what learners will gain from this module..."
                    />
                  </div>

                  <CertificateDurationField />
                </CardContent>
              </Card>

              {/* File Upload */}
              <Card className="py-[20px]">
                <CardContent>
                  {/* Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold mb-2">
                      Upload Training Content
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Drag and drop your files here, or click to browse
                    </p>
                    <div className="flex">
                      <input
                        id="fileInput"
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        ref={fileInputRef}
                        className="hidden"
                        accept="video/mp4,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        name="document"
                      />
                    </div>
                    <div className="w-full flex justify-center  bg-gray-50 cursor-pointer">
                      {/* Custom styled upload button */}
                      <label htmlFor="fileInput" className="cursor-pointer">
                        <div className="px-4  flex items-center justify-center bg-[#E6E6E6] gap-2  rounded-md text-sm  transition-colors">
                          {/* <UploadIcon /> */}
                          <p className="font-poppins text-[18px]">
                            Choose Files
                          </p>
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">
                      Supported: Video files (.mp4) and PPT files (.ppt,.pptx)
                    </p>
                    {selectedFiles?.length > 0 && (
                      <div>
                        {Object?.values(selectedFiles)?.map((file, index) => (
                          <div key={index}>
                            <p className="font-medium !text-[green]">
                              {file.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  name={"Create Module"}
                  classname="w-full"
                  type="submit"
                  buttonClick={() => {}}
                  isLoading={isLoading}
                />
                <Button
                  type="button"
                  name={"Cancel"}
                  classname="w-full bg-[gray]"
                  buttonClick={() => router.push(`/compliance/training`)}
                />
              </div>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
};
export default CreateTrainingModule;
