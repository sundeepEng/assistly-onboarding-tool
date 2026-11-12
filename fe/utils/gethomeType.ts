"use client"; // if you’re in Next.js app router

import useGetById from "../services/getById";
import { getHomeIdFromToken } from "./auth";
import { homePath } from "./constants";

export const useGetHomeType = () => {
  const loggedInUserHomeId = getHomeIdFromToken();

  const { data: HomeData } = useGetById({
    key: "home",
    payload: { id: loggedInUserHomeId, path: homePath, enabled: !!loggedInUserHomeId },
  });

  const homeType = HomeData?.home?.homeType;
  return homeType
};
