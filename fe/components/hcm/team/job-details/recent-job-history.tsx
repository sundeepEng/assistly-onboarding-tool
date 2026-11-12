import { useState } from "react";
import CommonModal from "../../../../commonComponents/common-modal";

const RecentJobHistory = () => {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const popoverBody = (
        <div className="flex justify-between items-center border-2 border-solid w-full rounded-xl p-[20px]">
            <h3>Hired at Tejaswini</h3>
            <div>Tue, May 20, 2025</div>
        </div>
    );
    return (
        <div>
            <div className="">
                <div className="flex justify-between">
                    <h2>Recent Job History</h2>
                    <h3
                        onClick={() => setPopoverOpen(!popoverOpen)}
                        className="justify-end text-steelblue underline cursor-pointer"
                    >
                        View all history
                    </h3>
                </div>
                <CommonModal
                    title="Add Medication"
                    modalOpen={popoverOpen}
                    titleClass={"text-[25px] font-semibold"}
                    setModalOpen={() => {
                        setPopoverOpen((prev) => !prev);
                    }}
                    crossCTA={true}
                    width="675px"
                    className="py-4"
                >
                    <div className="flex justify-between items-center w-[655px] rounded-xl p-[20px]">
                        <div className="flex items-center gap-3">
                            <div className="bg-steelblue w-[10px] h-[10px] rounded-2xl"></div>
                            <div>
                                <h3>Hired at Tejaswini</h3>
                            </div>
                        </div>
                        <div>Tue, May 20, 2025</div>
                    </div>
                </CommonModal>
            </div>
            <div className="flex justify-between items-center border-2 border-solid w-full rounded-xl p-[20px]">
                <h3>Hired at Tejaswini</h3>
                <div>Tue, May 20, 2025</div>
            </div>
        </div>
    );
};

export default RecentJobHistory;
