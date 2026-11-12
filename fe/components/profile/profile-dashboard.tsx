import Image from "next/image";
import { getInitials } from "../../utils/getSignatureUtil";
import Tabs from "../../commonComponents/tabs";
import { useState } from "react";
import ChangeProfileImage from "../changeProfileImage";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { PersonalDetailsFormWrapper } from "./personal-details";
import { ChangePassword } from "../nav";
import FileUploadManager, {
  UploadedFile,
} from "../../commonComponents/file-upload-manager";
import {
  CARE_LEAD,
  CARE_TEAM,
  homeDocsAllowedFormats,
  homePath,
  PCHODOCUMENTS,
  SR_LEAD,
  USER_PATH_OMIT_FIELDS,
  UserPath,
  userRoles,
} from "../../utils/constants";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { omit } from "../../utils/dateUtils";
import fetchPreSignedUrl from "../../services/get-presigned-url";
import { v4 as uuidv4 } from "uuid";
import useGetById from "../../services/getById";
import useUpdate from "../../services/update";
import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import _ from "lodash";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { handleSetProfileActiveTab } from "../../redux/slices/tab-slice";
import HomeDetailsFormWrapper from "./home-details";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../utils/auth";
import RoleIcon from "../../public/icons/role-icon";
import LocationIcon from "../../public/icons/location-icon";
import {
  EmptyUploadCard,
  EmptyUploadDocCard,
} from "../documents/documents-card";
import { Trash as FiTrash, Eye as FiEye, InfoIcon } from "lucide-react";
import { DeleteConfirmationModal } from "../documents/document-card-ui";
import CommonModal from "../../commonComponents/common-modal";
import Button from "../../commonComponents/button";
import InputFieldComponent from "../../commonComponents/input-field-component";
import Avatar from "../../commonComponents/avatar";

interface TabData {
  label: string;
  content: JSX.Element;
  // access?: { feature: string; type: Access }[];
}

const ProfileDashboard = ({ userData }) => {
  const homeId = getHomeIdFromToken();
  const { data: homeData } = useGetById({
    key: "home",
    payload: { id: homeId, path: homePath, enabled: !!homeId },
  });
  const role = getUserRoleFromToken();
  const tabData: TabData[] = [
    {
      label: "Personal Details",
      content: (
        <div className="w-[1024px]">
          <PersonalDetailsFormWrapper defaultValues={userData} />
        </div>
      ),
    },
    hasAccess(role as Role, "PROFILE_HOME_DETAILS", "EDIT")
      ? {
          label: "Home Details",
          content: (
            <div className="w-[1024px]">
              <HomeDetailsFormWrapper defaultValues={homeData?.home} />
            </div>
          ),
        }
      : null,
    {
      label: "Change Password",
      content: (
        <div className="w-[1024px]">
          <ChangePassword />
        </div>
      ),
    },
    hasAccess(role as Role, "PROFILE_DOCUMENTS", "EDIT")
      ? {
          label: "Documents",
          content: (
            <div className="overflow-y-auto w-[1024px]">
              <PCHOProfileDocuments />
            </div>
          ),
        }
      : null,
    {
      label: "Update Profile Image",
      content: (
        <div className="w-[1024px]">
          <ChangeProfileImage
            userData={userData} // Pass the user data
          />
        </div>
      ),
    },
  ].filter(Boolean) as TabData[]; // Filter out null entries

  const activeTab = useAppSelector((state) => state.tab.profileActiveTab);
  const dispatch = useAppDispatch();

  var UpdatedRole;

  switch (userData?.role) {
    case userRoles.PCG:
      UpdatedRole = CARE_TEAM;
      break;
    case userRoles.PCGLEAD:
      UpdatedRole = CARE_LEAD;
      break;
    case userRoles.LEAD:
      UpdatedRole = SR_LEAD;
      break;
    default:
      UpdatedRole = userData?.role;
  }

  return (
    <div className="w-full">
      <div className="px-[20px] font-jakarta text-heading font-semibold">
        Profile
      </div>
      <hr className="w-full border" />
      {/* Header Part start */}
      <div className="flex justify-between px-[20px] align-center">
        <div className="flex gap-4 p-1 font-jakarta">
          <Avatar
            src={userData?.profileImageUrl}
            name={userData?.name}
            size={100}
            variant="bordered"
            alt="Senior Profile"
            className="!font-medium"
          />
          <div className="flex flex-col  py-[20px]">
            <div className="text-heading font-semibold">
              {userData?.name && userData?.name}
            </div>
            <div className="flex text-base font-medium gap-2">
              <RoleIcon />
              {UpdatedRole} | <LocationIcon />
              <span>{_.startCase(_.toLower(homeData?.home?.homeName))}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Header Part End */}
      <div className="px-[20px]">
        <Tabs
          tabs={tabData}
          activeTab={activeTab}
          onTabChange={(label) => dispatch(handleSetProfileActiveTab(label))}
          activeTabClassName="!text-black text-2xl"
          containerClassName="!bg-[white]"
          tabTextClassName=""
          tabHeadingClassName="border-b border-solid border-gray1"
        />
      </div>
    </div>
  );
};

export default ProfileDashboard;

// This is for pencil icon to edit on the profile image

{
  /* <div className="relative w-[100px] h-[100px] cursor-pointer group">
          {userData?.profile_image_url ? (
            <>
              <Image
                className="h-full w-full object-cover rounded-full"
                loading="lazy"
                width={100}
                height={100}
                alt="Profile"
                src={userData?.profile_image_url}
              />
              <div
                onClick={() => {
                  // Trigger file upload or open modal
                }}
                className="absolute bottom-0 right-0"
              >
               dis 
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full w-full bg-gray-200 rounded-full">
              <h3 className="font-medium text-lg">
                {getInitials(userData?.name)}
              </h3>
            </div>
          )}
        </div> */
}

const PCHOProfileDocuments = () => {
  const dispatch = useAppDispatch();
  const loggedInUserId = getUserIdFromToken();
  const homeId = getHomeIdFromToken();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedFileToDelete, setSelectedFileToDelete] =
    useState<UploadedFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: userData } = useGetById({
    key: "user",
    payload: { id: loggedInUserId, path: UserPath, enabled: !!loggedInUserId },
  });

  const { mutate } = useUpdate();

  const handleUpload = async ({
    file,
    expirationDate,
    documentName,
    documentCategory,
  }: any) => {
    if (!file) {
      return Promise.reject(new Error("No file selected."));
    }

    // Validate file type
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

    // Validate size
    if (file.size > 2 * 1024 * 1024) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(`File too large (Max ${2}MB)`));
      return;
    }

    const bucketUploadPath = `${homeId}/${loggedInUserId}/${file.name}`;

    const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

    const uploadedFileUrl = await uploadToS3(
      file,
      bucketUploadPath,
      bucketName,
    );

    if (uploadedFileUrl) {
      const uploadedFile: any = {
        documentId: uuidv4(),
        documentCategory: documentCategory || "other",
        documentType: homeDocsAllowedFormats[file.type],
        documentUrl: uploadedFileUrl,
        documentName: documentName,
        createdByUserId: loggedInUserId,
        createdAt: new Date().toISOString(),
        isRequiredDocument: true,
      };
      // Only add expirationDate if it exists
      if (expirationDate) {
        uploadedFile.documentExpiryDate = expirationDate;
      }

      // Safely get existing documents, default to an empty array if none exist
      const existingDocuments = _.get(userData, "documents", []);

      // Remove old file with the same document name
      const filteredDocuments = existingDocuments.filter(
        (doc: any) => doc.documentName !== documentName,
      );

      // Add the new file
      const updatedDocuments = [...filteredDocuments, uploadedFile];

      // Prepare data to mutate (append documents to the home object)
      const userDataToUpdate = {
        ...userData,
        documents: updatedDocuments, // Update documents array with new one
      };

      // Filter out unwanted fields from the payload
      const cleanedData = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);
      // Prepare the payload and trigger mutation
      const payload = { data: cleanedData, path: UserPath };

      return new Promise<void>((resolve, reject) => {
        mutate(payload, {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Files Uploaded Successfully!"));

            resolve();
          },

          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                "Not able to upload Files, please try again",
              ),
            );

            reject(error);
          },
        });
      });
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Not able to upload file, please try again"),
      );
    }
  };

  const transformDocuments = (dbDocuments: any[]): UploadedFile[] => {
    return dbDocuments.map((doc) => ({
      documentId: doc.documentId, // keep original documentId for reference
      documentName: doc.documentName, // for matching later
      documentLabel: doc.documentName,
      uploadDate: new Date(doc.createdAt),
      expirationDate: doc.documentExpiryDate || undefined,
      url: doc.documentUrl,
      uploadedBy: doc.createdByUserId, // or fetch user name if available
      documentType: doc.documentType,
      isRequiredDocument: doc.isRequiredDocument || false,
      documentCategory: doc.documentCategory || "certificate",
    }));
  };

  const dbDocuments = _.get(userData, "documents", []);
  const formattedFiles = transformDocuments(dbDocuments);

  const handleView = async (file) => {
    try {
      const enabled = !!file.url;
      if (!enabled) return;
      const url = await fetchPreSignedUrl(file.url); // Fetch the pre-signed URL
      if (url) {
        if (file.documentType === ".doc" || file.documentType === ".docx") {
          window.open(
            `https://docs.google.com/gview?url=${encodeURIComponent(
              url,
            )}&embedded=true`,
            "_blank",
          );
        } else {
          window.open(url, "_blank");
        } // Opens the file in a new tab
      }
    } catch (error) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Unable to load File. Please try again."),
      );
    }
  };

  const handleDelete = async (file: UploadedFile) => {
    const fileName = file?.url?.split("/").pop();
    if (!fileName) return;
    const bucketUploadPath = `${homeId}/${loggedInUserId}/${fileName}`;
    const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

    const success: any = await deleteFromS3(
      fileName,
      bucketUploadPath,
      bucketName,
    );
    if (success) {
      // Filter out the file to be deleted
      const updatedDocuments = dbDocuments.filter(
        (doc: any) => doc.documentId !== file.documentId,
      );

      // Prepare data to mutate (append documents to the home object)
      const userDataToUpdate = {
        ...userData,
        documents: updatedDocuments, // Update documents array with new one
      };

      // Filter out unwanted fields from the payload
      const cleanedData = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);
      // Prepare the payload and trigger mutation
      const payload = { data: cleanedData, path: UserPath };
      mutate(payload, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("File Deleted Successfully!"));
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              "Not able to delete File, please try again",
            ),
          );
        },
      });
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Not able to delete File, please try again"),
      );
    }
  };
  let additionalDocuments: any = userData?.documents?.filter(
    (doc: any) => doc.documentCategory === "other",
  );
  additionalDocuments = transformDocuments(additionalDocuments || []);

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

  const handleAdditionalDocumentUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);

      await handleUpload({
        file: selectedFile,
        expirationDate,
        documentName: selectedFile.name,
        documentCategory: "other",
      });

      // Success
      setShowUploadModal(false);
      setSelectedFile(null);
      setExpirationDate("");
    } catch (error) {
      console.error(error);
      // handleUpload already shows the error popover,
      // so we don't need anything else here.
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <FileUploadManager
        documentTypes={PCHODOCUMENTS}
        initialFiles={formattedFiles}
        onUpload={handleUpload}
        onDelete={openDeletePopup}
        onView={handleView}
        cardItemsContainerClassName="!justify-start"
      />
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Additional Documents
        </h2>

        <div className={`flex flex-wrap gap-4`}>
          {/* Always keep one empty card */}
          <EmptyUploadDocCard
            onClick={() => {
              setSelectedFile(null);
              setExpirationDate("");
              setShowUploadModal(true);
            }}
          />
          {additionalDocuments?.map((doc, index) => (
            <div className=" mt-4 h-full bg-white border-[1px] border-solid border-[#D1D5DB] rounded-lg p-4 w-[320px] hover:shadow-md transition-shadow">
              <div className="text-md font-medium text-gray-900 mb-[10px]">
                {doc.documentName}{" "}
              </div>
              <div className="flex flex-col justify-between h-full">
                <div className="text-[14px]">
                  <p className="m-0">Uploaded by: {userData?.name}</p>
                  <p className="m-0">
                    Date: {doc.uploadDate.toLocaleDateString()}
                  </p>
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
          ))}
        </div>
      </section>

      <CommonModal
        modalOpen={showUploadModal}
        setModalOpen={(open) => {
          if (!uploading) {
            setShowUploadModal(open);
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
            disabled={uploading}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) {
                setSelectedFile(file);
              }
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
            buttonClick={handleAdditionalDocumentUpload}
            disabled={uploading || !selectedFile}
            classname="w-full"
            name={uploading ? "Uploading..." : "Upload File"}
            type="submit"
          />
        </div>
      </CommonModal>

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
};
