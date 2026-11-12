import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface SidebarCollapse {
  collapse: boolean;
}

const initialState: SidebarCollapse = {
  collapse: false,
};

const sidebarCollapseSlice = createSlice({
  name: "collapse",
  initialState,
  reducers: {
    handleSetSidebarCollapse: (
      state,
      action: PayloadAction<boolean | undefined>
    ) => {
      state.collapse =
        action.payload !== undefined ? action.payload : !state.collapse;
    },
  },
});

export const { handleSetSidebarCollapse } = sidebarCollapseSlice.actions;
export default sidebarCollapseSlice.reducer;
