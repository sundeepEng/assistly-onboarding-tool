import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = {
  currentDate: new Date().toISOString(),
};

type ScheduleDatePayload = string | number | Date;

const scheduleDateSlice = createSlice({
  name: "scheduleDate",
  initialState,
  reducers: {
    setScheduleDate(state, action: PayloadAction<ScheduleDatePayload>) {
      const payload = action.payload;

      if (payload instanceof Date) {
        state.currentDate = payload.toISOString();
        return;
      }

      if (typeof payload === "number") {
        state.currentDate = new Date(payload).toISOString();
        return;
      }

      state.currentDate = payload;
    },
  },
});

export const { setScheduleDate } = scheduleDateSlice.actions;
export default scheduleDateSlice.reducer;
