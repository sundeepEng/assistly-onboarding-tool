import FormInputCheckboxComponent from "../../commonComponents/form-input-checkbox-component";
import { basePathMedicalMobility } from "../../utils/constants";

function mobility() {
  const mobilityData = [
    {
      name: `${basePathMedicalMobility}.twoPersonTransfer`,
      label: "Two Person Transfer",
    },
    {
      name: `${basePathMedicalMobility}.mechanicalLift`,
      label: "Mechanical Lift",
    },
    {
      name: `${basePathMedicalMobility}.bedridden`,
      label: "Bed Ridden",
    },
    {
      name: `${basePathMedicalMobility}.nonAmbulatory`,
      label: "Non Ambulatory",
    },
  ];
  return (
    <div className="pl-[20px]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mobilityData?.map((mobility) => (
          <div>
            <FormInputCheckboxComponent
                name={mobility?.name}
                label={mobility?.label}
              />
          </div>
        ))}
      </div>
    </div>
  );
}

export default mobility;
