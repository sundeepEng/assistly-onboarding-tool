import { NextPage } from "next";
import CommonModal from "../../../commonComponents/common-modal";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { handleCloseEditTimeCardModal } from "../../../redux/slices/modal-slice";
import EditTimeCard from "./edit-time-card";

interface Props {}

const EditTimeCardModal: NextPage<Props> = ({}) => {
    const isEditTimeCardModalOpen = useAppSelector(
        (state: { modal: { isEditTimeCardModalOpen: boolean } }) =>
          state.modal.isEditTimeCardModalOpen
      );
      const dispatch = useAppDispatch();

  return (
    <div>
      <CommonModal
        modalOpen={isEditTimeCardModalOpen}
        setModalOpen={() => {
            dispatch(handleCloseEditTimeCardModal());
        }}
        crossCTA={true}
        className=""
      ><div className="px-[20px]">
        <EditTimeCard  />
        </div>
      </CommonModal>
    </div>
  );
};

export default EditTimeCardModal;
