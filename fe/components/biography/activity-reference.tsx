import FormInputCheckboxComponent from "../../commonComponents/form-input-checkbox-component";
import FormSelectComponent from "../../commonComponents/form-select-component";
import FormTextareaComponent from "../../commonComponents/form-textarea-component";
import {
  basePathActivityReferences,
  booleanOptions,
} from "../../utils/constants";

function ActivityReference() {
  const activitiesData = [
    {
      name: `${basePathActivityReferences}.hobbies.sports`,
      label: "Sports",
    },
    {
      name: `${basePathActivityReferences}.hobbies.music`,
      label: "Music",
    },
    {
      name: `${basePathActivityReferences}.hobbies.entertainment`,
      label: "Entertainment",
    },
    {
      name: `${basePathActivityReferences}.hobbies.readingAndWriting`,
      label: "Reading & Writing",
    },
    {
      name: `${basePathActivityReferences}.hobbies.collecting`,
      label: "Collecting",
    },
    {
      name: `${basePathActivityReferences}.hobbies.cooking`,
      label: "Cooking & Baking",
    },
    {
      name: `${basePathActivityReferences}.hobbies.arts`,
      label: "Arts & Crafts",
    },
    {
      name: `${basePathActivityReferences}.hobbies.games`,
      label: "Playing Games",
    },
    {
      name: `${basePathActivityReferences}.hobbies.exercise`,
      label: "Excercising",
    },
    {
      name: `${basePathActivityReferences}.hobbies.outdoorActivities`,
      label: "Outdoor Activities",
    },
    {
      name: `${basePathActivityReferences}.hobbies.cars`,
      label: "Cars",
    },
    {
      name: `${basePathActivityReferences}.hobbies.travel`,
      label: "Travel",
    },
  ];
  return (
    <div className="pl-[20px]">
      <div className="container mx-auto !overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-[10px]">
          {activitiesData?.map((activity) => (
            <div key={activity.name}>
              <FormInputCheckboxComponent
                name={activity?.name}
                label={activity?.label}
              />
            </div>
          ))}
        </div>
      </div>
      {/* TODO: Add info icon showing to add interested in any additional activities , also add proper schema */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-10">
        <div className="order-6 pt-5 pr-5">
          <FormTextareaComponent
            label={"Interested in additional activities"}
            placeholder={"Interested in additional activities"}
            className=""
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => void {}}
            name={`${basePathActivityReferences}.otherActivities`}
          />
        </div>
      </div>
    </div>
  );
}

export default ActivityReference;
