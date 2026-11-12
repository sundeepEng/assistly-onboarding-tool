"use client";

import React, { useCallback, useEffect, useState } from "react";
import CommonModal from "../../commonComponents/common-modal";
import { DocusealBuilder } from "@docuseal/react";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";

export type DocusealBuilderModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  buildToken: () => Promise<string>; // must return JWT token
  title?: string;
  onSend?: (data: any) => void;
  withSendButton?: boolean;
};

export default function DocusealBuilderModal({
  open,
  setOpen,
  buildToken,
  title = "DocuSeal Builder",
  onSend,
  withSendButton = true,
}: DocusealBuilderModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();

  const handleSend = (data: any) => {
    setOpen(false);
    dispatch(handleOpenPopover());
    dispatch(handleShowPopoverMessage("Email sent successfully!"));
    if (onSend) {
      onSend(data);
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setToken(null);
      const t = await buildToken();
      setToken(t);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      setError(String(e?.message || "Unable to load DocuSeal builder."));
    } finally {
      setLoading(false);
    }
  }, [buildToken]);

  useEffect(() => {
    if (open) {
      load();
      return;
    }

    setToken(null);
    setError(null);
    setLoading(false);
  }, [open, load]);

  return (
    <CommonModal
      title={title}
      modalOpen={open}
      setModalOpen={(v: boolean | ((prev: boolean) => boolean)) => {
        const nextOpen = typeof v === "function" ? v(open) : v;
        setOpen(nextOpen);
      }}
      crossCTA={true}
      className="w-[98vw] max-w-[1400px]"
      childContainerClass="justify-center"
    >
      {loading && <div className="p-4 text-sm text-gray-600">Loading…</div>}
      {error && <div className="p-4 text-sm text-red-600">{error}</div>}
      {token && !loading && !error && (
        <div className="h-[75vh] w-[90%]">
          <DocusealBuilder
            token={token}
            onSend={handleSend}
            withSendButton={withSendButton}
          />
        </div>
      )}
    </CommonModal>
  );
}