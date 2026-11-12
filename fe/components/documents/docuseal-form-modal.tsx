"use client";

import React from "react";
import CommonModal from "../../commonComponents/common-modal";
import { DocusealForm } from "@docuseal/react";

export default function DocusealFormModal({
  open,
  setOpen,
  docusealLoading,
  docusealError,
  docusealSlug,
  email,
  title = "E-Sign Document",
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  docusealLoading: boolean;
  docusealError: string | null;
  docusealSlug: string | null;
  email: string;
  title?: string;
}) {
  return (
    <CommonModal
      title={title}
      modalOpen={open}
      setModalOpen={setOpen}
      crossCTA={true}
      className="w-auto"
      titleClass="mr-[220px] ml-[20px]"
      childContainerClass=""
    >
      {docusealLoading && (
        <div className="p-4 text-sm text-gray-600">Loading signing form…</div>
      )}

      {docusealError && (
        <div className="p-4 text-sm text-red-600">{docusealError}</div>
      )}

      {docusealSlug && !docusealLoading && !docusealError && (
        <DocusealForm
          src={`https://docuseal.com/s/${docusealSlug}`}
          email={email || ""}
          expand={false}
        />
      )}
    </CommonModal>
  );
}
