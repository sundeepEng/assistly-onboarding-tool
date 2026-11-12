import React, { useEffect, useMemo, useState } from "react";
import CommonModal from "./common-modal";
import Button from "./button";
import InputFieldComponent from "./input-field-component";
import InputcheckboxComponent from "./input-checkbox-component";
import Loader from "./loader";
import { Users } from "lucide-react";
import useGetAll from "../services/getAll";
import useUpdate from "../services/update";
import { useAppDispatch } from "../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import {
  GetUsersPath,
  USER_PATH_OMIT_FIELDS,
  UserPath,
} from "../utils/constants";
import { getHomeIdFromToken } from "../utils/auth";
import { getInitials } from "../utils/getSignatureUtil";
import { omit } from "../utils/dateUtils";

// Generic row type for the assignable user (e.g. Senior, SalesDirector)
type AssignableUserRow = {
  userId?: string;
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  isDeleted?: boolean;
  [key: string]: any;
};

// Generic row type for the source user (e.g. Nurse, SalesRepresentative)
type SourceUserRow = {
  userId?: string;
  id?: string;
  name?: string;
  assignedSeniorIds?: string[];
  seniorIds?: string[];
  seniors?: Array<{ userId?: string; id?: string } | string>;
  associatedUserIds?:
    | string[]
    | Array<{ userId?: string; userName?: string; name?: string } | string>;
  [key: string]: any;
};

// Configuration props for customizing the modal's labels and behavior
interface AssignUsersModalConfig {
  /** Modal heading title, e.g. "Assign Seniors" or "Assign Sales Director" */
  title: string;
  /** Subtitle text, e.g. "Select which seniors {name} will care for" */
  subtitle: (sourceName: string) => string;
  /** Label for the "Currently Assigned" section */
  assignedSectionLabel: string;
  /** Label for the "All Users" section */
  allSectionLabel: string;
  /** Count label suffix, e.g. "seniors" or "directors" */
  countLabel: string;
  /** The userType param sent to the API to fetch assignable users */
  assignableUserType: string;
  /** React Query cache key for fetching assignable users */
  queryKey: string;
  /** Success message shown after saving */
  successMessage: string;
  /** Error message shown if save fails */
  errorMessage: string;
  /** Error message shown if source user has no userId */
  missingIdMessage: string;
}

interface AssignUsersModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Setter to open/close the modal */
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** The source user row data (e.g. the nurse or sales rep being edited) */
  sourceUser: SourceUserRow;
  /** Configuration for labels, API params, and messages */
  config: AssignUsersModalConfig;
  /** User IDs to exclude from the assignable list (e.g. already assigned to other users) */
  excludeUserIds?: string[];
}

// Helper to extract userId from various data shapes
function getUserId(s: any): string | null {
  return (s?.userId || s?.id || (typeof s === "string" ? s : null)) ?? null;
}

// Helper to extract name from various data shapes
function getUserName(s: any): string {
  return (
    s?.name ||
    s?.userName ||
    [s?.firstName, s?.lastName].filter(Boolean).join(" ") ||
    ""
  );
}

// Extracts the initially selected user IDs from the source user data
function coerceInitialSelectedIds(sourceUser?: SourceUserRow): string[] {
  const raw =
    (sourceUser?.assignedSeniorIds as any) ||
    (sourceUser?.seniorIds as any) ||
    (sourceUser?.seniors as any) ||
    (sourceUser?.associatedUserIds as any) ||
    [];

  if (!Array.isArray(raw)) return [];

  const ids = raw
    .map((x) => getUserId(x))
    .filter((x): x is string => !!x);

  return Array.from(new Set(ids));
}

/**
 * AssignUsersModal - A reusable modal for assigning users to another user.
 *
 * Used for:
 * - Assigning Seniors to a Nurse (nurse -> seniors)
 * - Assigning Sales Representatives to a Sales Director (sales rep -> directors)
 *
 * The modal fetches a list of assignable users, shows checkboxes for selection,
 * and saves the selected IDs as `associatedUserIds` on the source user record.
 */
const AssignUsersModal: React.FC<AssignUsersModalProps> = ({
  isOpen,
  setIsOpen,
  sourceUser,
  config,
  excludeUserIds = [],
}) => {
  const homeId = getHomeIdFromToken();
  const dispatch = useAppDispatch();
  const { mutate, isPending } = useUpdate();

  // Fetch the list of assignable users from the API
  const { data: assignableData, isLoading } = useGetAll({
    key: config.queryKey,
    params: {
      userType: config.assignableUserType,
      homeId: homeId || "",
    } as any,
    path: GetUsersPath,
  });

  // Filter out deleted users and excluded users from the fetched list
  const allActiveUsers: AssignableUserRow[] = useMemo(() => {
    const list = (assignableData as any)?.users || (assignableData as any) || [];
    if (!Array.isArray(list)) return [];
    return list.filter((s) => s?.isDeleted !== true && !excludeUserIds.includes(getUserId(s) || ""));
  }, [assignableData, excludeUserIds]);

  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Reset search and load initial selections when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setSelectedUserIds(coerceInitialSelectedIds(sourceUser));
  }, [isOpen, sourceUser]);

  // Build a map of assignable users by ID for quick lookup
  const usersById = useMemo(() => {
    const map = new Map<string, AssignableUserRow>();
    allActiveUsers.forEach((s) => {
      const id = getUserId(s);
      if (id) map.set(id, s);
    });
    return map;
  }, [allActiveUsers]);

  // Build fallback map from the source user's associatedUserIds
  const assignedFallbackById = useMemo(() => {
    const raw = (sourceUser?.associatedUserIds as any) || [];
    if (!Array.isArray(raw)) return new Map<string, AssignableUserRow>();

    const map = new Map<string, AssignableUserRow>();
    raw.forEach((x: any) => {
      const id = getUserId(x);
      if (!id) return;
      const name = getUserName(x);
      map.set(id, { userId: id, id, name } as any);
    });
    return map;
  }, [sourceUser]);

  // Resolve currently assigned users using the fetched data + fallback
  const currentlyAssigned = useMemo(() => {
    return selectedUserIds
      .map(
        (id) =>
          usersById.get(id) ||
          assignedFallbackById.get(id) ||
          ({ userId: id, id, name: "" } as any),
      )
      .filter(Boolean) as AssignableUserRow[];
  }, [selectedUserIds, usersById, assignedFallbackById]);

  // Filter the full list by search term
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allActiveUsers;
    return allActiveUsers.filter((s) =>
      getUserName(s).toLowerCase().includes(q),
    );
  }, [allActiveUsers, search]);

  // Toggle a user's selection on/off
  const toggleUser = (user: AssignableUserRow) => {
    const id = getUserId(user);
    if (!id) return;

    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Save the updated associatedUserIds to the backend
  const handleSave = () => {
    const sourceUserId = sourceUser?.userId;
    if (!sourceUserId) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(config.missingIdMessage));
      return;
    }

    const userDataToUpdate = {
      ...sourceUser,
      userId: sourceUserId,
      associatedUserIds: selectedUserIds,
    };

    const cleanedData: any = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);
    const payload = { data: cleanedData, path: UserPath };

    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage(config.successMessage));
        setIsOpen(false);
      },
      onError: (error: any) => {
        const apiError = error?.response?.data?.error;
        const errorMessage =
          !Array?.isArray(apiError) && apiError
            ? apiError
            : config.errorMessage;

        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(errorMessage));
      },
    });
  };

  return (
    <CommonModal
      width="600px"
      modalOpen={isOpen}
      setModalOpen={setIsOpen}
      crossCTA
    >
      <div className="w-full font-poppins">
        {/* Modal Header - icon, title, and subtitle */}
        <div className="flex gap-4 font-jakarta px-[24px] py-4">
          <div className="h-[60px] w-[60px] rounded-full bg-[#f5f7ff] flex items-center justify-center">
            <Users className="text-[#4F46E5]" size={22} />
          </div>
          <div className="flex flex-col">
            <div className="text-heading font-semibold">{config.title}</div>
            <div className="text-sm text-gray-500">
              {config.subtitle(sourceUser?.name || "this user")}
            </div>
          </div>
        </div>

        <hr className="w-full border " />

        {isLoading ? (
          <div className="w-full min-h-[520px] flex items-center justify-center px-[24px]">
            <Loader fullScreen={false} message="Loading..." />
          </div>
        ) : (
          <>
            {/* Currently Assigned Section */}
            <div className="flex items-center justify-between mb-2 px-[24px] mt-4">
              <div className="font-semibold">{config.assignedSectionLabel}</div>
              <div className="text-xs px-2 py-1 rounded-full bg-gray-100 ">
                {currentlyAssigned.length} {config.countLabel}
              </div>
            </div>

            {/* Assigned users displayed as removable chips */}
            <div className="bg-[#f5f7ff] rounded-lg p-3 flex flex-wrap gap-2 mb-6 min-h-[56px] mx-[24px]">
              {currentlyAssigned.length === 0 ? (
                <div className="text-sm text-gray-500 ">
                  No {config.countLabel} assigned yet.
                </div>
              ) : (
                currentlyAssigned.map((s) => {
                  const id = getUserId(s);
                  const name = getUserName(s);
                  const initials = getInitials(name);
                  return (
                    <div
                      key={id || name}
                      className="flex items-center gap-2 bg-white rounded-full px-3 py-2 shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#e9edff] flex items-center justify-center text-primary font-semibold text-xs">
                        {initials}
                      </div>
                      <div className="text-sm font-medium">{name}</div>
                      <button
                        type="button"
                        className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-500"
                        onClick={() => {
                          if (!id) return;
                          setSelectedUserIds((prev) =>
                            prev.filter((x) => x !== id),
                          );
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* All Assignable Users Section with search */}
            <div className="font-semibold mb-2 px-[24px]">{config.allSectionLabel}</div>

            <div className="mb-4 px-[24px]">
              <InputFieldComponent
                label={""}
                name="search"
                type="search"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                containerClass="!gap-0"
                titleClass="!h-[0px] !leading-[0px]"
                className="!h-[40px]"
              />
            </div>

            {/* Scrollable checkbox list of all assignable users */}
            <div className="border rounded-lg overflow-hidden px-[24px]">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  No {config.countLabel} found.
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto">
                  {filteredUsers.map((s) => {
                    const id = getUserId(s);
                    const name = getUserName(s);
                    const initials = getInitials(name);
                    const checked = id ? selectedUserIds.includes(id) : false;

                    return (
                      <div
                        key={id || name}
                        className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 ${
                          checked ? "bg-[#f5f7ff]" : "bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          <InputcheckboxComponent
                            name={id || name}
                            value={checked}
                            label={""}
                            onChange={() => toggleUser(s)}
                          />
                        </div>

                        <div className="w-10 h-10 rounded-full bg-[#e9edff] flex items-center justify-center text-primary font-semibold">
                          {initials}
                        </div>

                        <div className="text-sm font-medium">{name}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer action buttons */}
            <div className="flex justify-end gap-4 mt-6 px-[24px]">
              <Button
                type="button"
                name="Cancel"
                classname="!bg-white !text-black border border-gray-200"
                titleClass="!text-black"
                buttonClick={() => setIsOpen(false)}
              />
              <Button
                type="button"
                name="Save Changes"
                buttonClick={handleSave}
                isLoading={isPending}
                disabled={isPending}
              />
            </div>
          </>
        )}
      </div>
    </CommonModal>
  );
};

export default AssignUsersModal;
