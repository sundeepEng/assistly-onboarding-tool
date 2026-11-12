import { createSlice, PayloadAction } from '@reduxjs/toolkit';
interface dashboardRoute{
    activeTab:string
}
const initialState:dashboardRoute={
    activeTab:"crm"
}
const dashboardTabSlice=createSlice({
    name:'dashboardTab',
    initialState,
    reducers:{
        handleSetDashboardActiveTab:(state,action:PayloadAction<string>)=>{
            state.activeTab=action.payload
        }
    }
})
export const {handleSetDashboardActiveTab}=dashboardTabSlice.actions
export default dashboardTabSlice.reducer