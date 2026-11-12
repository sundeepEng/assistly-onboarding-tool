import React from 'react';
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from "react";
import Layout from "../../../components/layout";
import NurseHomePage from "../../../components/nurse/nurse-home-page";
import { RoleContext } from "../../../components/role-provider";
import useGetAll from "../../../services/getAll";
import { GetUsersPath, userRoles } from "../../../utils/constants";
import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import Loader from "../../../commonComponents/loader";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import Button from "../../../commonComponents/button";
import PlusIcon from "../../../public/icons/plus-icon";
import { useDispatch } from "react-redux";
import { handleOpenAddNurseModal } from "../../../redux/slices/modal-slice";

// CRM Nurse Leads list page.
// Mirrors the CRM PCG Lead list page.
const Index = () => {
  const router = useRouter();
  const [roleAccess, setRoleAccess] = useState(false);
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();

  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_NURSE_HOME", "EDIT"));
  }, [role]);

  const homeId = getHomeIdFromToken();
  const userId = getUserIdFromToken();

  const { data, isLoading } = useGetAll({
    key: userRoles.NURSELEAD,
    params: {
      userType: userRoles.NURSELEAD,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  useEffect(() => {
    if (!hasAccess(role as Role, "CRM_NURSE_HOME", "EDIT")) {
      const route = getInitialRoute(role as Role, userId);
      route && router.push(route);
    }
  }, [role, router]);

  const dispatch = useDispatch();

  return (
    <div>
      <Layout>
        {isLoading ? (
          <Loader />
        ) : roleAccess ? (
          <div>
            <div className="px-[10px]">
              <div className="flex justify-between">
                <div>
                  <div className="text-heading font-bold font-jakarta">
                    Nurse Leads
                  </div>
                  <div className="text-xs text-gray">
                    {data?.users?.length} Team members
                  </div>
                </div>

                <Button
                  name={"Add New"}
                  icon={<PlusIcon color="white" />}
                  classname="!text-white w-[139px] h-[40px]"
                  iconStart={true}
                  buttonClick={() => {
                    dispatch(handleOpenAddNurseModal());
                  }}
                />
              </div>

              <div className="py-[25px]">
                <NurseHomePage data={data?.users} />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <RestrictedPage />
          </div>
        )}
      </Layout>
    </div>
  );
};

export default Index;
