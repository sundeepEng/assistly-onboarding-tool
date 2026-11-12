import { ReactNode } from "react";

// Define the type for each tab
interface Tab {
  label: string;
  content: ReactNode;
}

// Props type for the Tabs component
interface TabsProps {
  tabs: Tab[];
  activeTab: string; // activeTab prop
  onTabChange: (label: string) => void; // Add onTabChange callback
  containerClassName?: string; // Custom Stylings for the Tab label container
  activeTabClassName?: string; // Custom styling for the Tab label
  tabTextClassName?: string; // Custom styling for the Tab text
  tabComponent?: ReactNode;
  tabHeadingClassName?:string
  contentClassName?:string
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab, // Receive activeTab from parent
  onTabChange, // Receive onTabChange from parent
  containerClassName = "",
  activeTabClassName = "",
  tabTextClassName = "",
  tabComponent,
  tabHeadingClassName,
  contentClassName = "",
}) => {
  const handleTabClick = (label: string) => {
    onTabChange(label); // Call the callback to update parent state
  };
  return (
    <div className="flex flex-col w-full bg-[white] rounded-[15px] font-jakarta">
      <div
        className={`flex justify-between bg-primary bg-opacity-15 ${containerClassName}`}
      >
        <div className={`flex justify-start ${tabHeadingClassName}`}>
          {tabs.map((tab, index) => (
            <div
              key={index} // Using index instead of label
              className={`flex flex-col items-center py-1 px-1 cursor-pointer ${
                activeTab === tab?.label
                  ? `border-b-4 rounded-[2px] border-solid border-primary ${activeTabClassName}`
                  : ""
              }`}
              onClick={() => handleTabClick(tab?.label)}
            >
              {/* Tab Text */}
              <span
                className={`text-xl font-semibold transition-colors duration-300 font-jakarta px-[20px] py-[10px] ${tabTextClassName}`}
              >
                {tab?.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-1 justify-center">
  {tabComponent && (
    <div className="flex justify-center items-center px-[10px]">
      {tabComponent}
    </div>
  )}
</div>

      </div>
      
      {/* Tabs Content */}
      <div className={contentClassName}>
        {tabs?.find((tab) => tab?.label === activeTab)?.content}
      </div>
    </div>
  );
};

export default Tabs;

// const tabData = [
//     {
//         label: "Medication",
//         content: (
//             <div className="p-4">
//                 <p>
//                     This is the content for Medication. hk jhfkjshfjhsd
//                     kjfshdjkhfksjhdfks dhfkshjssfskfgsdgsdflkfdjhgskljhglsd
//                     ffhskjdhfgls fhgkjshfg skjfhg skdjfhgslk fghlskdjhf
//                     glsjdkhfgl skjdhfglkjshfdlkgjhsdljfhglk fdghs
//                     dfjhglsdfhglkjsdh f kgjhs df ghslkfdjh
//                     gjkldhfgjkshdfgkjshdfjkghsdklfhgkljshfgjklshdkffjghkjdfhglskdfhgkjsdhfg
//                     sdklfhjg skdjfhguihsgfbgsurgjkhfbsdugh
//                     sdufghsdifgsurhglhfgishg sd,fhkgsuerkhgbsdfbgksdufgk
//                     gsdkfgksd fgksgdsbgsdfkgdgsdkfigsb
//                     kdfkggbskjdfgsdfgfhkshfd{" "}
//                 </p>
//             </div>
//         ),
//     },
//     {
//         label: "MedPass",
//         content: (
//             <div className="p-4">
//                 <p>This is the content for MedPass.</p>
//             </div>
//         ),
//     },
//     {
//         label: "Over-the-Counter Medication",
//         content: (
//             <div className="p-4">
//                 <p>This is the content for Over-the-Counter Medication.</p>
//             </div>
//         ),
//     },
//     {
//         label: "Care Plan",
//         content: (
//             <div className="p-4">
//                 <p>This is the content for Care Plan.</p>
//             </div>
//         ),
//     },
// ];

// const [activeTab, setActiveTab] = useState(tabData[0].label);  // Manage active tab in parent

// const handleTabChange = (label: string) => {
//     setActiveTab(label);
// };

// <div className="max-w-6xl mx-auto mt-8 w-[1100px]">
//                         <Tabs
//                             tabs={tabData}
//                             activeTab={activeTab}
//                             onTabChange={handleTabChange}
//                         />
//                     </div>
