import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface LeadsFilterState {
  milestoneFilter: string;
}

const initialState: LeadsFilterState = {
  milestoneFilter: "",
};

const leadsFilterSlice = createSlice({
  name: "leadsFilter",
  initialState,
  reducers: {
    setMilestoneFilter: (state, action: PayloadAction<string>) => {
      state.milestoneFilter = action.payload;
    },
    clearMilestoneFilter: (state) => {
      state.milestoneFilter = "";
    },
  },
});

export const { setMilestoneFilter, clearMilestoneFilter } = leadsFilterSlice.actions;
export default leadsFilterSlice.reducer;
