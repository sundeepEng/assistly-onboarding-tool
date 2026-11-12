import { configureStore } from "@reduxjs/toolkit";
import dashboardTabReducer from "./slices/dashboard-tab-slice";
import exampleReducer from "./slices/exampleSlice";
import exceptionPopverReducer from "./slices/exception-popover-slice";
import modalReducer from "./slices/modal-slice";
import tabReducer from "./slices/tab-slice";
import teamMemberTabReducer from "./slices/team-tab-slices";
import scheduleDateReducer from "./slices/schedule-date-slice";
import sidebarCollapseReducer from "./slices/sidebar-slice";
import medicationExtractionReducer from "./slices/medication-extraction-slice";
import leadsFilterReducer from "./slices/leads-filter-slice";
export const store = configureStore({
  reducer: {
    modal: modalReducer,
    example: exampleReducer,
    tab: tabReducer,
    dashboardTab: dashboardTabReducer,
    exceptionPopover: exceptionPopverReducer,
    teamMemberTab: teamMemberTabReducer,
    scheduleDate: scheduleDateReducer,
    sidebarCollapse: sidebarCollapseReducer,
    medicationExtraction: medicationExtractionReducer,
    leadsFilter: leadsFilterReducer,
  },
});

// Define RootState and AppDispatch types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
