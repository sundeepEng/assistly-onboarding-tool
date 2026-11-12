import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TabState {
  leadDataActiveTab: string;
  leadCarePlanActiveTab: string; 
  complianceActiveTab:string;
  profileActiveTab:string;
  careTeamActiveTab:string;
}

const initialState: TabState = {
  leadDataActiveTab: "Biography",
  leadCarePlanActiveTab:"ADL’S",
  complianceActiveTab:"Compliance",
  profileActiveTab:"Personal Details",
  careTeamActiveTab:"Documents"
};

const tabSlice = createSlice({
  name: 'tab',
  initialState,
  reducers: {
    handleSetLeadActiveTab: (state, action: PayloadAction<string>) => {
      state.leadDataActiveTab = action.payload;
    },
    handleSetCarePlanLeadActiveTab: (state, action: PayloadAction<string>) => {
      state.leadCarePlanActiveTab = action.payload;
    },
    handleSetProfileActiveTab: (state, action: PayloadAction<string>) => {
      state.profileActiveTab = action.payload;
    },
    handleSetCareTeamActiveTab: (state, action: PayloadAction<string>) => {
      state.careTeamActiveTab = action.payload;
    }

  },
});

export const { handleSetLeadActiveTab,handleSetCarePlanLeadActiveTab,handleSetProfileActiveTab,handleSetCareTeamActiveTab } = tabSlice.actions;
export default tabSlice.reducer;
