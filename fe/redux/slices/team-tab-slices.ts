import { createSlice, PayloadAction } from '@reduxjs/toolkit';
interface teamMemberRoute{
    activeTab:string
}
const initialState:teamMemberRoute={
    activeTab:"Job Details"
}
const teamMemberTabSlice=createSlice({
    name:'teamMemberTab',
    initialState,
    reducers:{
        handleSetTeamMemberActiveTab:(state,action:PayloadAction<string>)=>{
            state.activeTab=action.payload
        }
    }
})
export const {handleSetTeamMemberActiveTab}=teamMemberTabSlice.actions
export default teamMemberTabSlice.reducer