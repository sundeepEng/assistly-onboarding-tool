"use client";

import React, { useState } from "react";
import CommonModal from "../../commonComponents/common-modal";
import Button from "../../commonComponents/button";
import Loader from "../../commonComponents/loader";
import { Download, FileSignature } from "lucide-react";
import { Role } from "../../utils/roles";
import { getUserRoleFromToken } from "../../utils/auth";
import { hasAccess } from "../../utils/roleAccess";

export type EmarActionModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onDownload: () => void;
  onESign: () => Promise<void>;
  loading?: boolean;
  title?: string;
  description?: string;
  esignFeature?: string;
};

export default function EmarActionModal({
  open,
  setOpen,
  onDownload,
  onESign,
  loading = false,
  title = "EMAR Generated",
  description = "Your EMAR report has been generated successfully. What would you like to do?",
  esignFeature = "CLINICAL_EMAR_ESIGN",
}: EmarActionModalProps) {
  const [signingInProgress, setSigningInProgress] = useState(false);

  const handleESign = async () => {
    setSigningInProgress(true);
    try {
      await onESign();
    } finally {
      setSigningInProgress(false);
    }
  };

  const isLoading = loading || signingInProgress;

  const role = getUserRoleFromToken() as Role;

  return (
    <CommonModal
      title={title}
      modalOpen={open}
      setModalOpen={(v: boolean | ((prev: boolean) => boolean)) => {
        if (isLoading) return;
        const nextOpen = typeof v === "function" ? v(open) : v;
        setOpen(nextOpen);
      }}
      crossCTA={!isLoading}
      className="w-[500px]"
      childContainerClass="justify-center"
    >
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-center text-sm text-gray-600">{description}</p>

        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader fullScreen={false} />
            <p className="text-xs text-gray-500">
              Preparing document for e-signature…
            </p>
          </div>
        ) : (
          <div className="flex w-full gap-3">
            <Button
              name="Download PDF"
              icon={<Download size={16} color="white" />}
              classname="!text-white flex-1"
              iconStart={true}
              buttonClick={() => {
                onDownload();
                setOpen(false);
              }}
            />
            {hasAccess(role, esignFeature, "EDIT") && (
              <Button
                name="E-Sign PDF"
                icon={<FileSignature size={16} color="white" />}
                classname="!text-white flex-1 !bg-green-600 hover:!bg-green-700"
                iconStart={true}
                buttonClick={handleESign}
              />
            )}
          </div>
        )}
      </div>
    </CommonModal>
  );
}
