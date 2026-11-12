import React from 'react'; 
import { NextPage } from "next";
import TeamRosterTable from "../../../components/hcm/team/team-roster-table";
import Layout from "../../../components/layout";

interface Props {}

const Index: NextPage<Props> = ({}) => {
    return (
        <div>
            <Layout>
                <TeamRosterTable />
            </Layout>
        </div>
    );
};

export default Index;
