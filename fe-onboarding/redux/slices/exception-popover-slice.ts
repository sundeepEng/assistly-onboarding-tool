import { createSlice, PayloadAction } from '@reduxjs/toolkit'
interface initialStateProps{
    isPopoverVisible:boolean,
    popoverMessage:string,
    popoverCloseOptions:boolean,
    showWarningMessage:boolean
}
const initialState:initialStateProps={
    isPopoverVisible:false,
    popoverMessage:"",
    popoverCloseOptions:false,
    showWarningMessage:false
}
const exceptionSlice=createSlice({
    name:'exceptionPopover',
    initialState,
    reducers:{
        handleClosePopover:state=>{
            state.isPopoverVisible=false
        },
        handleOpenPopover:state=>{
            state.isPopoverVisible=true
        },
        handleShowPopoverMessage:(state,action:PayloadAction<string>)=>{
            state.popoverMessage=action.payload
        },
        handleShowCloseOptions:state=>{
            state.popoverCloseOptions=true
        },
        handleHideCloseOptions:state=>{
            state.popoverCloseOptions=false
        },
        handleShowWarningMessage:state=>{
            state.showWarningMessage=true
        }
    }
})
export const {handleClosePopover,handleOpenPopover,handleShowPopoverMessage,handleShowCloseOptions,handleHideCloseOptions,handleShowWarningMessage}=exceptionSlice.actions
export default exceptionSlice.reducer