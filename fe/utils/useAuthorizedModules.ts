import useGetById from "../services/getById";
import { getHomeIdFromToken } from "./auth";
import { accessAllModules, homePath } from "./constants";

/**
 * Custom hook to get authorized modules for the logged-in user
 * @returns Array of authorized module names
 */
export const useAuthorizedModules = () => {
  const loggedInUserHomeId = getHomeIdFromToken();
  const { data: HomeData } = useGetById({
    key: "home",
    payload: { id: loggedInUserHomeId, path: homePath ,enabled:!!loggedInUserHomeId},
  });

  const baseModules = HomeData?.home?.authorizedModules || accessAllModules;
  return baseModules;
};
