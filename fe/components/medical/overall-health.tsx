import FormInputCheckboxComponent from "../../commonComponents/form-input-checkbox-component";
import {
  basePathMedicalOverallHealth,
  baseVitalSignsPath,
  vitalSignsData,
} from "../../utils/constants";

function formatVitalLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function overallhealth({
  carePlanVitalSigns,
}: {
  carePlanVitalSigns?: Record<string, boolean>;
}) {
  console.log("OverallHealth carePlanVitalSigns", carePlanVitalSigns);

  const defaultVitalKeys = new Set(
    vitalSignsData
      .map((vital) => vital.name.split(".").pop())
      .filter((key): key is string => Boolean(key))
  );

  const vitalSigns = carePlanVitalSigns ?? {};
  const hasCustomVitalSigns = Object.keys(vitalSigns).some(
    (key) => !defaultVitalKeys.has(key)
  );

  if (hasCustomVitalSigns) {
    return (
      <div className="pl-[20px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.keys(vitalSigns).map((key) => (
            <div key={key}>
              <FormInputCheckboxComponent
                name={`${baseVitalSignsPath}.${key}`}
                label={formatVitalLabel(key)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const overallHealthData = [
    {
      name: `${basePathMedicalOverallHealth}.chronicIllness`,
      label: "Chronic illness",
    },
    {
      name: `${basePathMedicalOverallHealth}.developmentalDisability`,
      label: "Developmental Disability",
    },
    {
      name: `${basePathMedicalOverallHealth}.alzheimersOrDementia`,
      label: "Alzheimer's or Dementia",
    },
    {
      name: `${basePathMedicalOverallHealth}.mentalIllness`,
      label: "Mental illness",
    },
    {
      name: `${basePathMedicalOverallHealth}.smokesOrDrinks`,
      label: "Smoking/ Drinking",
    },
    {
      name: `${basePathMedicalOverallHealth}.ableToDrive`,
      label: "Able to Drive",
    },
  ];
  return (
    <div className="pl-[20px]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {overallHealthData?.map((overallHealth) => (
          <div key={overallHealth?.name}>
            <FormInputCheckboxComponent
              name={overallHealth?.name}
              label={overallHealth?.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default overallhealth;
