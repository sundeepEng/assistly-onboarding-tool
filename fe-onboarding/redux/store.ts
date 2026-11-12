import { configureStore } from "@reduxjs/toolkit";
import exceptionPopverReducer from "./slices/exception-popover-slice";

export const store = configureStore({
  reducer: {
    exceptionPopover: exceptionPopverReducer,
  },
});

// Define RootState and AppDispatch types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
