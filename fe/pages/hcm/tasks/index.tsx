import { useContext, useEffect, useState } from "react";
import Layout from "../../../components/layout";
import { RoleContext } from "../../../components/role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import Tabs from "../../../commonComponents/tabs";
import TaskLibrary from "../../../components/hcm/tasks/task-library";
import TaskStatus from "../../../components/hcm/tasks/task-status";
import Loader from "../../../commonComponents/loader";

const Index = () => {
    const [isMounted, setIsMounted] = useState(false);
    const role = useContext(RoleContext)?.role || getUserRoleFromToken();
    const hasTaskAccess = hasAccess(role as Role, "HCM_TASKS_ADMIN", "EDIT");
    const [activeTab, setActiveTab] = useState("Task Library");

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return (
            <Layout>
                <Loader fullScreen={false} />
            </Layout>
        );
    }

    if (!hasTaskAccess) {
        return (
            <Layout>
                <RestrictedPage />
            </Layout>
        );
    }

    return (
        <Layout>
            <div>
                <div>
                    <h2 className="text-2xl font-semibold text-[#2E2C34] px-4">
                        Tasks
                    </h2>
                </div>
                <Tabs
                    tabs={[
                        {
                            label: "Task Library",
                            content: <TaskLibrary />,
                        },
                        {
                            label: "Task Status",
                            content: <TaskStatus />,
                        },
                    ]}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    activeTabClassName="text-2xl"
                    containerClassName="!bg-[#f4f4f4] border-b border-solid border-[#C8C8CC] mb-6"
                />
            </div>
        </Layout>
    );
};

export default Index;
