"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import useGetById from "../../services/getById";
import { UserPath } from "../../utils/constants";
import useCommentUsers from "../../utils/useCommentUsers";
import Button from "../button";
import Avatar from "../avatar";
import TextareaComponent from "../textarea-component";
import { getUserIdFromToken } from "../../utils/auth";
import { formatToDateWithTime } from "../../components/hcm/utils/timeUtils";
import { getSelectedDateTimeIso } from "../../utils/dateUtils";

// Extracts the YYYY-MM-DD portion from a UTC ISO string (e.g. "2026-08-05T02:09:00.000Z" -> "2026-08-05")
const getUtcDateFromIso = (isoString?: string): string => isoString?.slice(0, 10) ?? "";


const CommentSection = ({ handleSubmitComment, data, selectedDate, editAccess = true }: any) => {
  const [comments, setComments] = useState(data || []);
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyId, setReplyId] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [textResetKey, setTextResetKey] = useState(0);
  useEffect(() => {
    setComments(data || []);
  }, [data]);
  const user = getUserIdFromToken();
  const userIds = comments.map((c) => c.createdByUserId);
  const { userMap, isLoading } = useCommentUsers({ userIds, path: UserPath });

  const { data: userData } = useGetById({
    key: "user",
    payload: { path: UserPath, id: user,enabled:!!user },
  });

  const addComment = (message, parentMessageId = null) => {
    const createdAt = selectedDate
      ? getSelectedDateTimeIso(selectedDate)
      : new Date().toISOString();
    const newComment = {
      message,
      parentMessageId,
      createdByUserId: user,
      createdAt,
      createdByUserName: userData?.name,
      messageId: uuidv4(),
    };
    setComments((prev) => [...prev, newComment]);
    const updatedComments = [...comments, newComment];
    handleSubmitComment(updatedComments);
  };
  const renderComments = (parentId = null) => {
    return comments
      ?.filter((comment: any) => comment?.parentMessageId === parentId)
      ?.filter((comment: any) =>
        parentId !== null || !selectedDate
          ? true
          : getUtcDateFromIso(comment?.createdAt) === selectedDate,
      )
      ?.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      ?.map((comment: any) => {
        const commentUser = userMap[comment.createdByUserId];
        return (
          <div key={comment?.messageId} className="border-l-2 pl-4 my-2 ">
            <div className="flex gap-2">
              <div className="flex rounded">
                <Avatar src={commentUser?.profileImageUrl} name={commentUser?.name} size={40} />
              </div>
              <div className="">
                <div className="flex items-center">
                  <p className="font-semibold">{commentUser?.name}</p>
                  <p className="font-poppins text-[10px] pl-[5px]">
                    {" "}
                    •{formatToDateWithTime(comment?.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="m-0 mb-1">{comment?.message}</p>
                </div>
                {editAccess && (
                  <button
                    className="text-blue-500 text-sm cursor-pointer rounded"
                    onClick={() => {
                      setShowReply(true), setReplyId(comment?.messageId);
                    }}
                  >
                    Reply
                  </button>
                )}
                {editAccess && showReply && replyId == comment?.messageId && (
                  <div className="mt-2">
                    <TextareaComponent
                      label={""}
                      value={replyMessage}
                      onChange={(e) => {
                        setReplyMessage(e.target.value);
                      }}
                      name={`reply-${comment?.messageId}`}
                      key={textResetKey}
                      autoFocus={true}
                    />
                    <Button
                      classname="text-white p-2 rounded mt-4 cursor-pointer"
                      buttonClick={() => {
                        if (replyMessage?.trim()) {
                          addComment(replyMessage.trim(), comment?.messageId);
                          setReplyMessage("");
                          setShowReply(false);
                          setTextResetKey((prevKey) => prevKey + 1);
                        } else {
                          setShowReply(false);
                        }
                      }}
                      name={"Add Reply"}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="m-4">{renderComments(comment?.messageId)}</div>
          </div>
        );
      });
  };
  return (
    <div className="py-4 border rounded-md w-full">
      {editAccess && (
        <>
          <TextareaComponent
            label={"Comments"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            name={"Comments"}
            key={textResetKey}
            className="!max-w-[549px] !w-full "
          />
          <Button
            classname="text-white p-2 mt-4 rounded w-[220px]"
            buttonClick={() => {
              if (message?.trim()) {
                addComment(message.trim());
              }
              setMessage("");
              setTextResetKey((prevKey) => prevKey + 1);
            }}
            name={"Add Comment"}
          />
        </>
      )}
      <div className="mt-4">{renderComments()}</div>
    </div>
  );
};

export default CommentSection;
