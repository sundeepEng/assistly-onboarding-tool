import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import CrossIcon from "../public/icons/cross-icon";

interface CommonModalProps {
    width?: string;
    children: React.ReactNode;
    title?: string;
    modalOpen: boolean;
    setModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    saveCTA?: boolean;
    crossCTA?: boolean;
    className?: string;
    titleClass?: string;
    childContainerClass?:string;
    paddingRight?:string;
}

const CommonModal: React.FC<CommonModalProps> = ({
    children,
    title,
    setModalOpen,
    modalOpen,
    width,
    crossCTA,
    className,
    titleClass,
    childContainerClass,
    paddingRight
}) => {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
        try {
            Modal.setAppElement("body");
        } catch {
            // no-op
        }
    }, []);

    if (!hasMounted) return null;

    return (
        <div>
            <Modal
                isOpen={modalOpen}
                onRequestClose={() => setModalOpen(false)}
                style={{
                    overlay: {
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        backdropFilter: "blur(5px)",
                        zIndex: 1000,
                    },
                    content: {
                        top: "50%",
                        left: "50%",
                        right: "auto",
                        bottom: "auto",
                        marginRight: "-50%",
                        transform: "translate(-50%, -50%)",
                        padding: "20px 0px",
                        ...(paddingRight !== undefined && { paddingRight: paddingRight }),
                        borderRadius: "10px",
                        border: "none",
                        boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.3)",
                        width: width,
                        height: "auto",
                        maxWidth: "90%",
                        maxHeight:'100vh',
                        zIndex: 1001, // Content should be above overlay
                        overflow: "visible",
                    },
                }}
            >
                <div
                    className={`flex flex-col items-center ${className}`}
                >
                    <div className="flex w-full">
                        <div className="flex-1"></div>
                        <div className="flex-2">
                            {title && (
                                <div
                                    style={{ marginBottom: "20px" }}
                                    className={`flex-1 relative text-lg font-poppins text-black font-[500] text-left ${titleClass}`}
                                >
                                    {title}
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            {crossCTA && (
                                <div
                                    className="absolute top-4 right-6 cursor-pointer"
                                    onClick={() => setModalOpen(false)}
                                >
                                    <CrossIcon />
                                </div>
                            )}
                        </div>
                    </div>
                     <div className={`flex w-full max-h-[85vh] overflow-y-auto overflow-x-auto justify-center ${childContainerClass}`}>{children}</div>
                </div>
            </Modal>
        </div>
    );
};

export default CommonModal;
