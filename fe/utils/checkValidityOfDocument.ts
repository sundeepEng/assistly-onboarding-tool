interface documentTypeProps {
  alertPeriodInDays?: number;
  expirationDate: string; // stored as "YYYY-MM-DD"
}

export const CheckValidityOfDocument = ({
  alertPeriodInDays = 0,
  expirationDate,
}: documentTypeProps) => {

  if (!expirationDate) {
    return null;
  }
  // Parse expiration date (handle both "YYYY-MM-DD" and ISO "YYYY-MM-DDTHH:mm:ss.sssZ" formats)
  const dateOnly = expirationDate.split("T")[0]; // Extract just the date part
  const [year, month, day] = dateOnly.split("-").map(Number);
  const expiry = new Date(year, month - 1, day);

  // Get today at midnight
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Difference in days (ignores time)
  const diffInMs = expiry.getTime() - today.getTime();
  const remainingDays = Math.round(diffInMs / (1000 * 3600 * 24));

  if (remainingDays > alertPeriodInDays) {
    return null; // No message (more than 30 days away)
  } else if (remainingDays > 1) {
    return {
      message: `Document will expire in ${remainingDays} days`,
      color: "text-yellow-500",
      border:"border-[yellow]"
    };
  } else if (remainingDays === 1) {
    return {
      message: "Document will expire tomorrow",
      color: "text-yellow-500",
      border:"border-[yellow]"
    };
  } else if (remainingDays === 0) {
    return {
      message: "Document expires today",
      color: "text-yellow-500",
      border:"border-[yellow]"
    };
  } else if (remainingDays === -1) {
    return {
      message: "Document expired yesterday",
      color: "text-red-600",
      border:"border-red-500"
    };
  } else {
    const expiredDaysAgo = Math.abs(remainingDays);
    return {
      message: `Document expired ${expiredDaysAgo} days ago`,
      color: "text-red-600",
      border:"border-red-500 "
    };
  }
};
