import { createSlice } from "@reduxjs/toolkit";

interface ModalState {
  isAddLeadModalOpen: boolean;
  isAddMedicationModalOpen: boolean;
  isOverTheCounterMediactionModalOpen: boolean;
  isAddReferralModalOpen: boolean;
  isEditReferralModalOpen: boolean;
  editReferralData: any | null;
  isAddIncidentModalOpen: boolean;
  isAddPCGModalOpen: boolean;
  isAddNurseModalOpen: boolean;
  isEditTimeCardModalOpen: boolean;
  editTimeCardData: any | null;
  isAddShiftModalOpen: boolean;
  isAddTaskModalOpen: boolean;
  isProfileModalOpen: boolean;
  isRequestTimeOffModalOpen: boolean;
  isAddComplianceModalOpen: boolean;
  isAddSalesMemberModalOpen: boolean;
  isSupportModalOpen: boolean;
}

const initialState: ModalState = {
  isAddLeadModalOpen: false,
  isAddMedicationModalOpen: false,
  isOverTheCounterMediactionModalOpen: false,
  isAddReferralModalOpen: false,
  isEditReferralModalOpen: false,
  editReferralData: null,
  isAddIncidentModalOpen: false,
  isAddPCGModalOpen: false,
  isAddNurseModalOpen: false,
  isEditTimeCardModalOpen: false,
  editTimeCardData: null,
  isAddShiftModalOpen: false,
  isAddTaskModalOpen: false,
  isProfileModalOpen: false,
  isRequestTimeOffModalOpen: false,
  isAddComplianceModalOpen: false,
  isAddSalesMemberModalOpen: false,
  isSupportModalOpen: false,
};

const modalSlice = createSlice({
  name: "modal",
  initialState,
  reducers: {
    handleOpenAddLeadModal: (state) => {
      state.isAddLeadModalOpen = true;
    },
    handleCloseAddLeadModal: (state) => {
      state.isAddLeadModalOpen = false;
    },
    handleOpenAddMedicationModal: (state) => {
      state.isAddMedicationModalOpen = true;
    },
    handleCloseAddMedicationModal: (state) => {
      state.isAddMedicationModalOpen = false;
    },
    handleOpenOverTheCounterMediactionModal: (state) => {
      state.isOverTheCounterMediactionModalOpen = true;
    },
    handleCloseOverTheCounterMediactionModal: (state) => {
      state.isOverTheCounterMediactionModalOpen = false;
    },
    handleOpenAddReferralModal: (state) => {
      state.isAddReferralModalOpen = true;
    },
    handleCloseAddReferralModal: (state) => {
      state.isAddReferralModalOpen = false;
    },
    // Open edit referral modal with referral data for pre-filling form
    handleOpenEditReferralModal: (state, action) => {
      state.isEditReferralModalOpen = true;
      state.editReferralData = action.payload;
    },
    // Close edit referral modal and clear the referral data
    handleCloseEditReferralModal: (state) => {
      state.isEditReferralModalOpen = false;
      state.editReferralData = null;
    },
    handleOpenAddIncidentModal: (state) => {
      state.isAddIncidentModalOpen = true;
    },
    handleCloseAddIncidentModal: (state) => {
      state.isAddIncidentModalOpen = false;
    },
    handleOpenAddPCGModal: (state) => {
      state.isAddPCGModalOpen = true;
    },
    handleCloseAddPCGModal: (state) => {
      state.isAddPCGModalOpen = false;
    },
    handleOpenAddNurseModal: (state) => {
      state.isAddNurseModalOpen = true;
    },
    handleCloseAddNurseModal: (state) => {
      state.isAddNurseModalOpen = false;
    },
    handleCloseEditTimeCardModal: (state) => {
      state.isEditTimeCardModalOpen = false;
      state.editTimeCardData = null;
    },
    handleOpenEditTimeCardModal: (state, action) => {
      state.isEditTimeCardModalOpen = true;
      state.editTimeCardData = action.payload;
    },
    handleOpenAddShiftModal: (state) => {
      state.isAddShiftModalOpen = true;
    },
    handleCloseAddShiftModal: (state) => {
      state.isAddShiftModalOpen = false;
    },
    handleOpenAddTaskModal: (state) => {
      state.isAddTaskModalOpen = true;
    },
    handleCloseAddTaskModal: (state) => {
      state.isAddTaskModalOpen = false;
    },
    handleOpenProfileModal: (state) => {
      state.isProfileModalOpen = true;
    },
    handleCloseProfileModal: (state) => {
      state.isProfileModalOpen = false;
    },
    handleOpenRequestTimeOffModal: (state) => {
      state.isRequestTimeOffModalOpen = true;
    },
    handleCloseRequestTimeOffModal: (state) => {
      state.isRequestTimeOffModalOpen = false;
    },
    handleOpenAddGuestModal: (state) => {
      state.isAddComplianceModalOpen = true;
    },
    handleCloseAddGuestModal: (state) => {
      state.isAddComplianceModalOpen = false;
    },
    handleOpenAddSalesMemberModal: (state) => {
      state.isAddSalesMemberModalOpen = true;
    },
    handleCloseAddSalesMemberModal: (state) => {
      state.isAddSalesMemberModalOpen = false;
    },
    handleOpenSupportModal: (state) => {
      state.isSupportModalOpen = true;
    },
    handleCloseSupportModal: (state) => {
      state.isSupportModalOpen = false;
    },
  },
});

export const {
  handleOpenAddLeadModal,
  handleCloseAddLeadModal,
  handleOpenAddShiftModal,
  handleCloseAddShiftModal,
  handleOpenAddTaskModal,
  handleCloseAddTaskModal,
  handleOpenAddMedicationModal,
  handleCloseAddMedicationModal,
  handleOpenOverTheCounterMediactionModal,
  handleCloseOverTheCounterMediactionModal,
  handleOpenAddReferralModal,
  handleCloseAddReferralModal,
  handleOpenEditReferralModal,
  handleCloseEditReferralModal,
  handleOpenAddIncidentModal,
  handleCloseAddIncidentModal,
  handleOpenAddPCGModal,
  handleCloseAddPCGModal,
  handleOpenAddNurseModal,
  handleCloseAddNurseModal,
  handleCloseEditTimeCardModal,
  handleOpenEditTimeCardModal,
  handleOpenProfileModal,
  handleCloseProfileModal,
  handleOpenRequestTimeOffModal,
  handleCloseRequestTimeOffModal,
  handleOpenAddGuestModal,
  handleCloseAddGuestModal,
  handleOpenAddSalesMemberModal,
  handleCloseAddSalesMemberModal,
  handleOpenSupportModal,
  handleCloseSupportModal,
} = modalSlice.actions;
export default modalSlice.reducer;
