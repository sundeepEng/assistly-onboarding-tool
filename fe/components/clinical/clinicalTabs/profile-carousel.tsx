"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useGetAll from "../../../services/getAll";
import useGetById from "../../../services/getById";
import {
  GetUsersPath,
  milestones,
  UserPath,
  userRoles,
} from "../../../utils/constants";
import { getInitials } from "../../../utils/getSignatureUtil";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import CarouselRightArrowIcon from "../../../public/icons/carousel-right-arrow-icon";
import CarouselLeftArrowIcon from "../../../public/icons/carousel-left-arrow-icon";

const ProfileCarousel = ({ setActiveTab }) => {
  const router = useRouter();
  const pathname = usePathname();
  const carouselRef = useRef<HTMLDivElement>(null);

  const activeSeniorID = pathname?.split("/").pop();
  const [activeSenior, setActiveSenior] = useState<string | null>(
    activeSeniorID || null
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const homeId = getHomeIdFromToken();
  const role = getUserRoleFromToken();
  const loggedInUserId = getUserIdFromToken();
  const isNurse = role === userRoles?.NURSE;

  const { data: seniorData } = useGetAll({
    key: "user",
    params: {
      userType: userRoles?.SENIOR,
      homeId: homeId,
      milestone: milestones?.CONTRACT,
    },
    path: GetUsersPath,
  });

  // Nurses only see seniors assigned to them, so fetch the nurse record
  // which persists those assignments in associatedUserIds.
  const { data: nurseData, isLoading: isNurseLoading } = useGetById({
    key: "nurse-assigned-seniors",
    payload: {
      id: loggedInUserId || "",
      path: UserPath,
      enabled: isNurse && !!loggedInUserId,
    },
  });

  const assignedSeniorIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isNurse || !nurseData) return ids;
    const raw =
      nurseData?.associatedUserIds ||
      nurseData?.assignedSeniorIds ||
      nurseData?.seniorIds ||
      nurseData?.seniors ||
      [];
    if (!Array.isArray(raw)) return ids;
    raw.forEach((s: any) => {
      const id = String(s?.userId || s?.id || s || "");
      if (id) ids.add(id);
    });
    return ids;
  }, [isNurse, nurseData]);

  const seniors = useMemo(() => {
    const all = seniorData?.users || [];
    if (!isNurse) return all;
    if (isNurseLoading || !nurseData) return [];
    return all.filter(
      (s: any) => assignedSeniorIds.has(s?.userId) || assignedSeniorIds.has(s?.id)
    );
  }, [seniorData, isNurse, isNurseLoading, nurseData, assignedSeniorIds]);

  useEffect(() => {
    setActiveSenior(activeSeniorID || null);
  }, [activeSeniorID]);

  useEffect(() => {
    const activeEl = activeSenior ? itemRefs.current[activeSenior] : null;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeSenior, seniors]);

  useEffect(() => {
    const checkScroll = () => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
      }
    };

    checkScroll(); // Initial check
    carouselRef.current?.addEventListener("scroll", checkScroll);

    return () => {
      carouselRef.current?.removeEventListener("scroll", checkScroll);
    };
  }, [seniors]); // Run whenever data updates

  const handleProfileClick = (id: string) => {
    setActiveTab();
    setActiveSenior(id);
    router.push(`/clinical/${id}`);
  };

  const scrollLeft = () => {
    carouselRef.current?.scrollBy({ left: -150, behavior: "smooth" });
  };

  const scrollRight = () => {
    carouselRef.current?.scrollBy({ left: 150, behavior: "smooth" });
  };

  return (
    <div className="flex items-center justify-center pt-[50px] px-[30px]">
      {canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="p-2 pb-[20px] bg-transparent cursor-pointer"
        >
          <CarouselLeftArrowIcon/>
        </button>
      )}

      <div
        ref={carouselRef}
        className="flex overflow-x-auto pt-[10px] no-scrollbar space-x-4"
      >
        {seniors?.map((senior) => (
          <div
            key={senior?.userId}
            ref={(el) => {
              itemRefs.current[senior?.userId] = el;
            }}
            onClick={() => handleProfileClick(senior.userId)}
            className={`cursor-pointer px-[10px] flex flex-col !py-0 !mb-0 items-center transition-all ${
              activeSenior === senior.userId ? "" : "opacity-40"
            }`}
          >
            {senior.profileImageUrl ? (
              <img
                src={senior?.profileImageUrl}
                alt={senior?.name}
                className="w-[138px] h-[138px] rounded-full border-2 border-gray-300 shadow-lg object-cover"
              />
            ) : (
              <div className="w-[138px] h-[138px] rounded-full border-solid border-2 border-primary bg-primary bg-opacity-20 flex items-center justify-center">
                <div className="text-center text-primary font-bold text-20xl font-jakarta">
                  {getInitials(senior?.name)}
                </div>
              </div>
            )}
            <p
              className={`mt-2 text-lg font-jakarta font-semibold text-center ${
                activeSenior === senior.userId ? "text-black" : "text-gray-500"
              }`}
            >
              {senior?.name}
            </p>
          </div>
        ))}
      </div>

      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="p-2 pb-[20px] bg-transparent cursor-pointer"
        >
          <CarouselRightArrowIcon />
        </button>
      )}
    </div>
  );
};

export default ProfileCarousel;
