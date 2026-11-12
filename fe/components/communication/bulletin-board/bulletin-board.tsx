import { Clock, MessagesSquare, Send } from "lucide-react";
import Button from "../../../commonComponents/button";
import Avatar from "../../../commonComponents/avatar";
import { useContext, useState } from "react";
import TextareaComponent from "../../../commonComponents/textarea-component";
import useGetAll from "../../../services/getAll";
import {
  BROADCAST,
  bullitenBoardPath,
  getBullitenBoardPath,
  UserPath,
} from "../../../utils/constants";
import useCreate from "../../../services/create";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { timeAgo } from "../../../utils/dateUtils";
import Loader from "../../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import useCommentUsers from "../../../utils/useCommentUsers";
import { RoleContext } from "../../role-provider";
import { ProtectedComponent } from "../../protectedComponent";
import { Role } from "../../../utils/roles";

export function BroadcastList() {
  const [isComposing, setIsComposing] = useState(false); // default show compose box

  const homeId = getHomeIdFromToken() || "";
  const userId = getUserIdFromToken() || "";

  const { data, isLoading, error } = useGetAll({
    key: BROADCAST,
    params: {
      home_id: homeId,
    },
    path: getBullitenBoardPath,
  });

  const role = useContext(RoleContext)?.role || getUserRoleFromToken();

  // collect all users data
  const userIds = data?.broadcasts?.map((c) => c.sender_user_id);
  const { userMap } = useCommentUsers({ userIds, path: UserPath });

  const { mutate: createBroadcast } = useCreate();

  const [newMessage, setNewMessage] = useState("");

  const dispatch = useDispatch();

  const handleSendBroadcast = () => {
    if (!newMessage.trim()) return;

    const dataForBroadcast = {
      home_id: homeId,
      sender_user_id: userId,
      message: newMessage,
    };

    const payloadDataForBroadcast = {
      userData: dataForBroadcast,
      path: bullitenBoardPath,
    };

    createBroadcast(payloadDataForBroadcast, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Broadcast sent successfully."));
      },
      onError: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            "Failed to send broadcast. Please try again.",
          ),
        );
      },
    });

    setNewMessage("");
    setIsComposing(false);
  };

  if (isLoading)
    return (
      <div>
        <Loader fullScreen={false} />
      </div>
    );

  return (
    <ProtectedComponent
      role={role as Role}
      feature="HCM_TEAM_BROADCAST"
      access="EDIT"
    >
      <div className="p-1  bg-white w-full border border-[#D9D9D9] border-solid rounded-lg shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex justify-center items-center gap-2">
            <MessagesSquare className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Care Team Broadcasts</h2>
          </div>
          <div>
            <Button
              name={"New Broadcast"}
              icon={<Send className="w-5 h-5 text-white" />}
              buttonClick={() => setIsComposing(true)}
            />
          </div>
        </div>

        {/* Compose new message */}
        {isComposing && (
          <div className="m-4 p-4 rounded-lg border border border-[#D9D9D9] border-solid shadow-md w-3/4">
            <TextareaComponent
              label="Compose Message"
              name="broadcastMessage"
              placeholder="Type your message to the entire team..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[130px]"
            />
            <div className="flex gap-2 pt-2 justify-end">
              <Button
                name={"Cancel"}
                buttonClick={() => setIsComposing(false)}
                classname="!bg-[white] !border !border-[#D9D9D9] !border-solid"
                titleClass="!text-[black]"
              />

              <Button
                name={"Send"}
                buttonClick={handleSendBroadcast}
                disabled={!newMessage.trim()}
              />
            </div>
          </div>
        )}

        {/* Broadcast messages list */}
        <div className="h-[400px] w-full overflow-auto rounded-lg border p-4">
          <div className="flex flex-col gap-2">
            {!Array.isArray(data?.broadcasts) ||
            data?.broadcasts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-[26px] text-[#9C9999] font-medium font-poppins">
                  No broadcasts to display
                </p>
              </div>
            ) : (
              data?.broadcasts?.map((broadcast) => {
                const senderUserData = userMap[broadcast?.sender_user_id];
                return (
                  <div
                    key={broadcast?.id}
                    className="flex gap-3 rounded-lg border p-4 border border-[#D9D9D9] border-solid shadow-md"
                  >
                    {/* Avatar */}
                    <Avatar src={senderUserData?.profileImageUrl} name={broadcast?.user_name || ""} size={40} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm">
                          {broadcast?.user_name}
                        </span>
                        <span className="text-xs font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(broadcast?.created_at)}
                        </span>
                      </div>
                      <div className="text-sm p-2 break-words">
                        {broadcast?.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ProtectedComponent>
  );
}
