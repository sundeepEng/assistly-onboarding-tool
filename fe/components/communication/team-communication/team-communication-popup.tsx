"use client";

import { Bot, ChartArea, Cookie, MessageSquare, X } from "lucide-react";
import { useMemo, useState } from "react";
import CommonModal from "../../../commonComponents/common-modal";
import { MessageCard } from "./message-card";
import useGetAll from "../../../services/getAll";
import { GetUsersPath, userRoles } from "../../../utils/constants";
import { getHomeIdFromToken} from "../../../utils/auth";
import Loader from "../../../commonComponents/loader";

export default function TeamCommunicationPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const homeId = getHomeIdFromToken() || "";

  const {
    data: PCHOs,
    error: pchoError,
    isLoading: pchoLoading,
  } = useGetAll({
    key: userRoles.LEAD,
    params: {
      userType: userRoles.PCHO,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  const {
    data: PCGs,
    error: pcgError,
    isLoading: pcgLoading,
  } = useGetAll({
    key: userRoles.LEAD,
    params: {
      userType: userRoles.PCG,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  const combinedUsers = useMemo(() => {
    const all = [];
    if (Array.isArray(PCHOs?.users)) all.push(...PCHOs?.users);
    if (Array.isArray(PCGs?.users)) all.push(...PCGs?.users);
    return all;
  }, [PCHOs, PCGs]);

  if (pchoLoading || pcgLoading) {
    return <Loader fullScreen={false} />;
  }

  if (pchoError || pcgError) {
    return (
      <div className="text-center p-4 text-red-500">Failed to load users.</div>
    );
  }

  return (
    <div className="fixed bottom-20 right-40 z-50">
      {isOpen && (
        <div>
          <CommonModal
            modalOpen={isOpen}
            setModalOpen={setIsOpen}
            title="Team Communication"
            crossCTA={true}
          >
            <div className="px-[20px]">
              <MessageCard users={combinedUsers} />
            </div>
          </CommonModal>
        </div>
      )}
      <div className="flex justify-end ">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-primary text-white w-16 h-16 flex items-center justify-center rounded-full shadow-xl cursor-pointer group "
        >
          {isOpen ? (
            <X className="w-10 h-10 transition-transform duration-200 group-hover:scale-125" />
          ) : (
            <MessageSquare className="w-10 h-10 transition-transform duration-200 group-hover:scale-125" />
          )}
        </button>
      </div>
    </div>
  );
}
