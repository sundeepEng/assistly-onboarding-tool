import { useMemo } from "react";
import { ResidentCard } from "./residents-cards";
import useGetAll from "../../../services/getAll";
import { ClinicalUserPath, GetUsersPath, milestones, userRoles, invoicePath } from "../../../utils/constants";
import { getHomeIdFromToken } from "../../../utils/auth";
import Loader from "../../../commonComponents/loader";

interface ResidentsProps {
  filterMonth?: string;
}

export default function Residents({ filterMonth }: ResidentsProps) {
  const homeId = getHomeIdFromToken();

  // Fetch active seniors from backend
  const { data: seniorsData, isLoading } = useGetAll({
    key: "user",
    params: {
      userType: userRoles?.SENIOR,
      homeId: homeId,
      milestone: milestones?.CONTRACT,
    },
    path: GetUsersPath,
  });

  // Fetch invoices data with billing period filter
  const { data: invoicesData } = useGetAll({
    key: "invoices",
    params: { home_id: homeId, billing_period: filterMonth },
    path: invoicePath
  });

  // Filter out deleted/inactive seniors and map to ResidentCard expected shape
  const residents =
    seniorsData?.users
      ?.filter((user: any) => !user?.isDeleted)
      ?.map((user: any) => ({
        id: user?.userId ?? user?.id,
        name: user?.name ?? "Unknown",
        room_number: user?.clinical?.roomNumber ?? user?.roomNumber ?? "",
        status: "active",
        profile_image: user?.profileImageUrl ?? user?.image ?? null,
      })) ?? [];

  // Map invoices to the format expected by ResidentCard (API already handles billing period filtering)
  const invoices = useMemo(() => {
    const rawInvoices = invoicesData?.invoices || invoicesData || [];
    if (!Array.isArray(rawInvoices)) return [];

    return rawInvoices
      .map((inv: any) => ({
        id: inv.id,
        senior_id: inv.user_id,
        amount: Number(inv.total_amount) || 0,
        status: inv.status?.toLowerCase() || "pending",
      }));
  }, [invoicesData]);

  if (isLoading) {
    return (
      <div className="p-6">
        <Loader fullScreen={false} />
      </div>
    );
  }

  return (
    <div>
      <div className="p-6">
        <div className="flex flex-wrap gap-6">
          {residents.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No active residents found
            </div>
          ) : (
            residents.map((resident) => (
              <ResidentCard
                key={resident.id}
                senior={resident}
                invoices={invoices}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
