import React, { useState } from "react";
import CommonModal from "../../commonComponents/common-modal";
import Button from "../../commonComponents/button";
import Loader from "../../commonComponents/loader";
import fetchPreSignedUrl from "../../services/get-presigned-url";

export const ViewOptionModal = ({
  open,
  setOpen,
  documentName,
  isLoading = false,
  onView,
  onDownload,
  signedDocumentUrl = [],
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  documentName?: string;
  isLoading?: boolean;
  onView: () => void;
  onDownload: () => void;
  signedDocumentUrl?: { url: string; createdAt: string }[];
}) => {
  const displayDocumentName = (documentName ?? "this document")
    .trim()
    .replace(/\s*\*+$/, "")
    .replace(/\.\w+$/, "");

  const validSignedUrls = (signedDocumentUrl || [])
    .filter((item) => item && item.url)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [openingIdx, setOpeningIdx] = useState<number | null>(null);

  const handleOpenSignedVersion = async (url: string, idx: number) => {
    try {
      setOpeningIdx(idx);
      const presignedUrl = await fetchPreSignedUrl(url);
      window.open(presignedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to get presigned URL for signed version:", err);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningIdx(null);
    }
  };

  return (
    <CommonModal title="View Document" modalOpen={open} setModalOpen={setOpen} crossCTA>
      <div className="font-poppins min-w-[450px] px-[20px] bg-[transparent]">
        {/* Current Version */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Current Version
          </div>
          <div className="text-sm text-gray-700 mb-2">
            How would you like to open{" "}
            <span className="font-semibold text-gray-900 ml-1">
              {displayDocumentName || "this document"}
            </span>
            &nbsp;?
          </div>
          <div className="text-[14px] text-gray-500 max-w-[600px]">
            You can preview this document instantly in your browser or download the original file to your device.
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <Loader fullScreen={false} message="" />
          </div>
        ) : (
          <div className="flex justify-center gap-6">
            <Button
              name="Preview"
              classname="bg-blue-600 text-white"
              titleClass="!text-[14px]"
              buttonClick={onView}
            />
            <Button
              name="Download"
              classname="bg-gray-300 text-black"
              titleClass="!text-[14px]"
              buttonClick={onDownload}
            />
          </div>
        )}

        {/* Signed Versions */}
        {validSignedUrls.length > 0 && (
          <div className="mt-4">
            <div className="border-t border-gray-200 my-4" />
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Signed Versions
            </div>
            <div className="flex flex-col gap-3">
              {validSignedUrls.map((item, idx) => (
                <div key={idx}>
                  {idx > 0 && <div className="border-t border-gray-100 my-2" />}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-gray-500">
                        Version {validSignedUrls.length - idx}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {displayDocumentName}
                      </div>
                    </div>
                    <Button
                      name={openingIdx === idx ? "Opening..." : "Open"}
                      classname="bg-black text-white"
                      titleClass="!text-[13px]"
                      buttonClick={() => handleOpenSignedVersion(item.url, idx)}
                      disabled={openingIdx === idx}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CommonModal>
  );
};