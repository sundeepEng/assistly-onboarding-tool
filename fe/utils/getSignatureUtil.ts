import useGetById from "../services/getById";
import { UserPath } from "./constants";

export const GetSignature = (id) => {
    const { data } = useGetById({
        key: "user",
        payload: { id: id || "", path: UserPath,enabled:!!id },
    });

    const userWithInitials = {
        ...(data || {}),
        initials: getInitials(data?.name || ""),
    };

    return userWithInitials;
};

export function getInitials(name) {
    if (!name) return "";
    
    const words = name
      ?.replace(/([a-z])([A-Z])/g, "$1 $2")
      ?.replace(/_/g, " ")
      ?.split(" ")
      ?.filter(Boolean); // Remove empty strings

    if (words?.length === 1) return words[0][0]?.toUpperCase();
    if (words?.length >= 3) return (words[0][0] + words[words?.length - 1][0])?.toUpperCase();
    
    return (words[0][0] + words[1][0])?.toUpperCase();
}
export function toTitleCase(str = "") {
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}