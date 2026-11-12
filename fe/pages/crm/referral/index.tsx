import React from 'react'; 
import { useState, useContext, useEffect } from "react";
import Layout from "../../../components/layout";
import ReferralHomePage from "../../../components/referral/referral-home-page";
import { RoleContext } from "../../../components/role-provider";
import { getInitialRoute, hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { useRouter } from "next/router";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import Button from "../../../commonComponents/button";
import PlusIcon from "../../../public/icons/plus-icon";
import useGetAll from "../../../services/getAll";
import { GetUsersPath, userRoles } from "../../../utils/constants";
import { useDispatch } from "react-redux";
import { handleOpenAddReferralModal } from "../../../redux/slices/modal-slice";
import { ProtectedComponent } from "../../../components/protectedComponent";

const Index = () => {
  const [roleAccess, setRoleAccess] = useState(false);
  const router = useRouter();
  const role = useContext(RoleContext)?.role || getUserRoleFromToken();
  const [toggle,setToggle]=useState(false)

  useEffect(() => {
    setRoleAccess(hasAccess(role as Role, "CRM_REFERRAL", "EDIT"));
    if (!hasAccess(role as Role, "CRM_REFERRAL", "EDIT")) {
      const route = getInitialRoute(role as Role, getUserIdFromToken());
      route && router.push(route);
    }
  }, [role, router]);
  const homeId = getHomeIdFromToken();
  const dispatch = useDispatch();
  const { data, isLoading } = useGetAll({
    key: userRoles.REFERRAL,
    params: {
      userType: userRoles?.REFERRAL,
      homeId: homeId,
    },
    path: GetUsersPath,
  });
  return (
    <div>
      <Layout>
        {roleAccess ? (
          <div className="px-[10px]">
            <div className="flex justify-between">
              <div className="">
                <div className="text-heading font-bold font-jakarta">
                  Referral Agents
                </div>
                <div className="text-xs text-gray">
                  {data?.users?.length} Team members
                </div>
              </div>
              <div></div>
           <ProtectedComponent role={role as Role} feature={"SMART_CRM"} access={"EDIT"}>
           {!toggle&&  <Button
                name={"Add New"}
                icon={<PlusIcon color="white" />}
                classname="!text-white w-[139px] h-[40px]"
                iconStart={true}
                buttonClick={() => {
                  dispatch(handleOpenAddReferralModal());
                }}
              />}
              </ProtectedComponent> 
            </div>
            <ReferralHomePage toggle={toggle} setToggle={setToggle}/>
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
