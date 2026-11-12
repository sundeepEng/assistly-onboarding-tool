"use client";

import React, { useMemo } from "react";
import CommonModal from "../../commonComponents/common-modal";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { useAppDispatch } from "../../redux/hooks";
import { uploadToS3 } from "../../utils/uploadToS3";
import WordEditor from "./word-editor";
export type DocxEditorModalOnSaveArgs = {
  uploadedUrl: string;
  bucketKey: string;
  bucketName: string;
  documentName: string;
  documentType: string;
};

export type DocxEditorModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  title?: string;
  presignedGetUrl: string | null;
  saveBucketName: string;
  saveBucketKey: string;
  documentName: string;
  onSaved?: (args: DocxEditorModalOnSaveArgs) => void;
};

export default function DocxEditorModal({
  open,
  setOpen,
  title = "Edit Document",
  presignedGetUrl,
  saveBucketName,
  saveBucketKey,
  documentName,
  onSaved,
}: DocxEditorModalProps) {
  const dispatch = useAppDispatch();

  const docType = useMemo(
    () =>
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    [],
  );

  const documentTypeExt = useMemo(() => ".docx", []);

  return (
    <CommonModal
      title={title}
      modalOpen={open}
      setModalOpen={setOpen}
      crossCTA={true}
      className="w-[98vw] max-w-[1400px]"
      childContainerClass="justify-center"
    >
      <div className="h-[75vh] w-[90%]">
        <WordEditor
          documentEntPresignedUrl={presignedGetUrl || ""}
          onSave={async (blob) => {
            try {
              if (!saveBucketName) throw new Error("Missing save bucket name.");
              if (!saveBucketKey) throw new Error("Missing save key.");
              if (!documentName) throw new Error("Missing document name.");
              if (!presignedGetUrl) throw new Error("Missing document URL.");

              const file = new File([blob], documentName, { type: docType });
              const uploadedUrl = await uploadToS3(
                file,
                saveBucketKey,
                saveBucketName,
                true,
              );

              if (!uploadedUrl) throw new Error("Upload failed");

              onSaved?.({
                uploadedUrl,
                bucketKey: saveBucketKey,
                bucketName: saveBucketName,
                documentName,
                documentType: documentTypeExt,
              });

              dispatch(handleOpenPopover());
              dispatch(handleShowPopoverMessage("Document saved."));
              setOpen(false);
            } catch (e: any) {
              // eslint-disable-next-line no-console
              console.error(e);
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(
                  String(e?.message || "Unable to save document."),
                ),
              );
            }
          }}
        />
      </div>
    </CommonModal>
  );
}
