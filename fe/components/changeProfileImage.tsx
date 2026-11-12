import { useState } from "react";
import UploadIcon from "../public/icons/upload-icon";
import useUpdate from "../services/update";
import { MaxSizeforImage, USER_PATH_OMIT_FIELDS, UserPath } from "../utils/constants";

import Button from "../commonComponents/button";
import {
    handleOpenPopover,
    handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import { Senior } from "../types/senior-types";
import { omit } from "../utils/dateUtils";
import { uploadToS3 } from "../utils/uploadToS3";
import { useAppDispatch } from "../redux/hooks";

interface ChangeProfileImageProps {
    userData: Senior;
    setModalClose?: any;
    setProfileImageUrl?: (url: string) => void;
}

const ChangeProfileImage = ({
    userData,
    setModalClose,
    setProfileImageUrl
}: ChangeProfileImageProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(
        userData?.profileImageUrl || null
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const dispatch = useAppDispatch();

    const { mutate } = useUpdate();

    const allowedFormats: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    };

    const maxSizeMB = MaxSizeforImage;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e?.target?.files || e?.target?.files?.length === 0) return;

        const file = e?.target?.files[0];
        setErrorMessage(null);

        // Validate file type
        if (!allowedFormats[file?.type]) {
            setErrorMessage("Only JPG, PNG images are allowed.");
            return;
        }

        // Validate file size
        if (file?.size > maxSizeMB * 1024 * 1024) {
            setErrorMessage(`Image size should not exceed ${maxSizeMB}MB.`);
            return;
        }

        setSelectedFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!selectedFile) {
            setErrorMessage("Please select an image");
            return;
        }

        setIsLoading(true);

        try {
            // Generate unique filename for S3
            const fileExtension = allowedFormats[selectedFile?.type];
            const uniqueFilename = `${
                userData?.userId
            }/profile-${Date.now()}.${fileExtension}`;

            const bucketName =
                process.env.NEXT_PUBLIC_AWS_PROFILE_IMAGES_BUCKET_NAME;

            if (!bucketName) {
                throw new Error("S3 bucket name is not configured");
            }

            // Upload to S3
            const fileUrl = await uploadToS3(
                selectedFile,
                uniqueFilename,
                bucketName,
                true
            );

            if (!fileUrl) {
                throw new Error("Failed to upload image");
            }

            // Update user data with new profile image URL
            const updatedUserData = {
                ...userData,
                profileImageUrl: fileUrl,
            };

            // Prepare payload
            const cleanedData: any = omit(updatedUserData, USER_PATH_OMIT_FIELDS);
            const payload = {
                data: cleanedData,
                path: UserPath,
            };
            // Update user in database
            mutate(payload, {
                onSuccess: () => {
                    dispatch(handleOpenPopover());
                    dispatch(
                        handleShowPopoverMessage(
                            "Profile image updated successfully!"
                        )
                    );
                    setProfileImageUrl && setProfileImageUrl(fileUrl);
                    setModalClose && setModalClose();
                },
                onError: (error: any) => {
                    setErrorMessage(
                        error?.response?.data?.message ||
                            "Failed to update profile image"
                    );
                },
            });
        } catch (error) {
            setErrorMessage("Error uploading image. Please try again.");
            console.error("Error uploading profile image:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setPreviewUrl(userData?.profileImageUrl || null);
        setErrorMessage(null);
        setModalClose && setModalClose();
    };

    return (
        <div className="p-[10px]">
            <div className="flex flex-col items-center gap-4">
                {/* Profile Image Preview */}
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-gray-200">
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt="Profile preview"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-500">No image</span>
                        </div>
                    )}
                </div>

                {/* File Upload */}
                <div className="bg-gray-50 cursor-pointer text-center">
                    <input
                        id="profileImageInput"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <label
                        htmlFor="profileImageInput"
                        className="cursor-pointer flex flex-col items-center"
                    >
                        <div className="px-6 py-1 flex items-center justify-center bg-[#E6E6E6] gap-2 rounded-md text-sm transition-colors">
                            <UploadIcon />
                            <p className="font-poppins">Choose Image</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Only JPG, PNG (max {maxSizeMB}MB)
                        </p>
                    </label>
                </div>

                {selectedFile && (
                    <p className="text-sm text-gray-600">
                        Selected: {selectedFile?.name}
                    </p>
                )}

                {errorMessage && (
                    <p className="text-red-500 text-sm">{errorMessage}</p>
                )}

                <div className="flex justify-center pt-2 gap-2">
                    <Button
                        name="Cancel"
                        classname="bg-gray-300 hover:bg-gray-400"
                        buttonClick={handleCancel}
                    />
                    <Button
                        name="Save"
                        buttonClick={handleSubmit}
                        isLoading={isLoading}
                    />
                </div>
            </div>
        </div>
    );
};

export default ChangeProfileImage;
