import React from "react";
import CommonModal from "./common-modal";
import { Lock } from "lucide-react";
import MailIcon from "../public/icons/mail-icon";
import Button from "./button";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  moduleName,
}) => {
  return (
    <CommonModal
      modalOpen={isOpen}
      setModalOpen={() => onClose()}
      width="400px"
      crossCTA={false}
      className="font-jakarta"
    >
      <div className="text-center mx-4">
        <div className="mb-6">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-yellow-100 text-yellow-500 rounded-full">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">
            Access Required
          </h3>
          <p className="text-gray-600 mb-4">
            You don&apos;t have access to the{" "}
            <span className="font-medium">{moduleName}</span> module. This
            feature requires an upgraded account.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please contact your administrator or support to upgrade your account
            and unlock this feature.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-center gap-2">
              <MailIcon />
              <span className="text-gray-700">Please contact:</span>
              <a
                href="mailto:support@assistly.care"
                className="text-primary font-medium hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = "mailto:support@assistly.care";
                }}
              >
                support@assistly.care
              </a>
            </div>
          </div>
        </div>

        <Button buttonClick={onClose} classname="w-full" name="Close" />
      </div>
    </CommonModal>
  );
};

export default UpgradeModal;
