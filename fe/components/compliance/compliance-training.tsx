'use client'
import React, { useContext, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../../commonComponents/card";
import Button from "../../commonComponents/button";
import useGetById from "../../services/getById";
import {
  ComplianceTrainingAllowedTypes,
  defaultTrainingFolder,
  homePath,
  UserPath,
} from "../../utils/constants";
import { useRouter } from "next/router";
import { ArrowRight, Presentation, Video } from "lucide-react";
import { ProtectedComponent } from "../protectedComponent";
import { RoleContext } from "../role-provider";
import { Role } from "../../utils/roles";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../utils/auth";
import DeleteIcon from "../../public/icons/delete-icon";
import {
  deleteFromS3,
  fetchFilesFroms3Folder,
} from "../../utils/uploadToS3";
import useUpsert from "../../services/upsert";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import CommonModal from "../../commonComponents/common-modal";
import { TailSpin } from "react-loader-spinner";
import { transformS3ModulesToStructured } from "../../utils/complianceUtil";

export const ComplianceTraining = () => {
  const homeId = getHomeIdFromToken();
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  const userId = getUserIdFromToken();
  const { mutate } = useUpsert();
  const dispatch = useDispatch();
  const [openModal, setModalOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<any | null>(null);
 const [defaultTrainingFiles, setDefaultTrainingFiles] = useState<
  Record<string, any>
>({});

const [isDefaultTrainingLoading, setIsDefaultTrainingLoading] = useState(true);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);
  // Get HOME by home id
  const { data: HomeData } = useGetById({
    key: "home",
    payload: { id: homeId, path: homePath,enabled:!!homeId },
  });
  const router = useRouter();

  const trainingModule = HomeData?.home?.complianceTraining
    ?.map((module) => ({
      ...module,
      documents: module?.documents?.filter((doc) =>
        ComplianceTrainingAllowedTypes.includes(doc.documentType)
      ),
    }))
    .filter((module) => module?.documents?.length > 0);
  const { data: userData } = useGetById({
    key: "userId",
    payload: { id: userId, path: UserPath,enabled:!!userId },
  });
  const openDeleteModal = (module) => {
    setSelectedModule(module);
    setModalOpen(true);
  };
  const closeDeleteModal = () => {
    setModalOpen(false);
    setSelectedModule(null);
  };
  const handleDeleteTraining = async (module) => {
    const updatedArray = HomeData?.home?.complianceTraining?.filter(
      (item) => item.moduleId !== module?.moduleId
    );
    HomeData.home.complianceTraining = updatedArray;
    module?.documents?.forEach(async (document) => {
      const fileName = document?.documentUrl?.split("/").pop();
      if (!fileName) return;
      const bucketUploadPath = `${homeId}/ComplianceTraining/${module?.moduleId}/${document.documentName}`;
      const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;
      const success: any = await deleteFromS3(
        fileName,
        bucketUploadPath,
        bucketName
      );
      if (success) {
        const payload = { data: HomeData?.home, path: homePath };
        mutate(payload, {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Module deleted succesfully!"));
            router.push(`/compliance/training`);
            setModalOpen(false);
          },
          onError: (err: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage("Failed to delete training module")
            );
          },
        });
      }
    });
  };
const sortedModules = useMemo(() => {
  return (trainingModule ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}, [trainingModule]);

 const handleFetchDefaultTrainingModules = async () => {
  const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

  try {
    setIsDefaultTrainingLoading(true);

    const files = await fetchFilesFroms3Folder(
      bucketName,
      defaultTrainingFolder
    );

    setDefaultTrainingFiles(files || {});
  } catch (error) {
    console.error("Failed to fetch default training modules", error);
    setDefaultTrainingFiles({});
  } finally {
    setIsDefaultTrainingLoading(false);
  }
};


  useEffect(() => {
    handleFetchDefaultTrainingModules();
  }, []);

  const transformS3Modules = (
  modules: Record<string, { video?: string; ppt?: string }>
) => {
  return Object.entries(modules || {}).map(([moduleName, files]) =>
    transformS3ModulesToStructured(moduleName, files as any)
  );
};

const complianceTraining = useMemo(() => {
  const defaultModules = transformS3Modules(defaultTrainingFiles);
  return [...defaultModules, ...sortedModules];
}, [defaultTrainingFiles, sortedModules]);

const shouldShowSkeleton =
  isDefaultTrainingLoading || !HomeData || !userData;

    const cookieRole = getUserRoleFromToken();

    const TrainingCardSkeleton = () => {
  return (
    <CardContent className="border-2-solid rounded-lg bg-[white] h-[200px] w-[300px] py-[5px] px-[15px] animate-pulse">
      <div className="h-[24px] bg-gray-200 rounded w-3/4 mt-3" />
      <div className="h-[18px] bg-gray-200 rounded w-1/2 mt-4" />
      <div className="flex justify-between items-center mt-8">
        <div className="h-[18px] bg-gray-200 rounded w-[70px]" />
        <div className="h-[24px] bg-gray-200 rounded w-[80px]" />
      </div>
      <div className="flex justify-between items-center mt-6">
        <div className="h-[40px] bg-gray-200 rounded w-[130px]" />
        <div className="h-[36px] bg-gray-200 rounded-full w-[36px]" />
      </div>
    </CardContent>
  );
};
  return (
    <div className="font-poppins">
      <h1 className="text-3xl font-bold">Training Module</h1>
      <div className="text-xs text-gray">
        {complianceTraining?.length} Training Modules
      </div>
      <div className="">
        <Card className=" px-[20px]">
          <ProtectedComponent
            role={role as Role}
            feature={"CREATE_COMPLIANCE_TRAINING"}
            access={"EDIT"}
          >
            <div className="flex items-center justify-end">
              <Button
                name={"+ Create New Module"}
                buttonClick={() =>
                  router.push(`/compliance/training/createModule`)
                }
                type="button"
              />
            </div>
          </ProtectedComponent>

         <div className="flex flex-wrap justify-start gap-y-10 gap-x-12 mt-[20px] min-h-[430px]">
  {shouldShowSkeleton ? (
    Array.from({ length: 6 }).map((_, index) => (
      <TrainingCardSkeleton key={`training-skeleton-${index}`} />
    ))
  ) : (
    complianceTraining?.map((module) => {
              const trainingCompleted =
                userData?.completedComplianceDocumentIds?.includes(
                  module.moduleId
                );
              return (
  <div key={module.moduleId || module.moduleName}>
                  <CardContent className="border-2-solid rounded-lg bg-[white] h-[200px] w-[300px] py-[5px] px-[15px] ">
                    <div>
                      <h3 className="font-semibold h-[60px] text-wrap">
                        {module.moduleName?.length > 50
                          ? `${module.moduleName.substring(0, 50)}...`
                          : module.moduleName}
                      </h3>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex justify-start gap-4">
                        {module?.documents?.map((document) => {
                          return (
                            <div>
                              <div className="flex gap-4 left-6">
                                <div className="">
                                  <div>
                                    {document.documentType === ".mp4" && (
                                      <Video className="h-4 w-4 text-blue-500" />
                                    )}
                                    {(document.documentType === ".ppt" ||
                                      document.documentType === ".pptx") && (
                                      <Presentation className="h-4 w-4 text-green-500" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {trainingCompleted ? (
                        <div className="bg-green-300 text-[green] px-[5px] bg-opacity-30 rounded-md text-[14px]">
                          Certified
                        </div>
                      ) : (
                        <div className="bg-red-300 text-[red] px-[5px] bg-opacity-30 rounded-md text-[14px]">
                          Pending
                        </div>
                      )}
                    </div>
                    <div className="flex mt-4 justify-between w-full items-center">
                      <div className="flex">
                        <Button
                          buttonClick={() =>
                            router.push(
                              `/compliance/training/${module.moduleId}`
                            )
                          }
                          name={"Start Training"}
                          icon={
                            <ArrowRight className="h-6 w-6 mr-1 text-[white]" />
                          }
                          iconStart={false}
                        />
                      </div>
                    <ProtectedComponent role={cookieRole as Role} feature={"COMPLIANCE_TRAINING"} access={"EDIT"}>{module?.moduleType!="default"&&  <div
                        className="flex bg-[#FAD1C0] w-[36px] h-[36px] rounded-[50%] justify-center items-center cursor-pointer"
                        onClick={() => openDeleteModal(module)}
                      >
                        <DeleteIcon color="#930301" />
                      </div>}
                      </ProtectedComponent>
                    </div>
                  </CardContent>
                </div>
              );
              })
  )}
</div>
        </Card>
      </div>
      {openModal && (
        <ConfirmationModal
          module={selectedModule}
          handleDeleteTraining={handleDeleteTraining}
          setModalOpen={setModalOpen}
          openModal={openModal}
        />
      )}
    </div>
  );
};
const ConfirmationModal = ({
  module,
  handleDeleteTraining,
  setModalOpen,
  openModal,
}) => {

  const [isLoading, setIsLoading] = useState(false);
  return (
    <CommonModal
      title={"Delete Module"}
      modalOpen={openModal}
      setModalOpen={setModalOpen}
      crossCTA={true}
    >
      <div className="font-poppins min-w-[450px] px-[20px] bg-[transparent]">
        <div className="mb-4">
          <div className="text-sm text-gray-700 mb-4">
            Are you sure you want to delete this{" "}
            <strong>{module?.moduleName}</strong> Training Module?
            <hr />
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <TailSpin
              height={50}
              width={50}
              color="#6B7280"
              strokeWidth="4px"
            />
          </div>
        ) : (
          <div className="flex justify-center gap-6">
            <Button
              name="Confirm"
              classname="bg-green-500 text-white"
              titleClass="!text-[14px]"
              buttonClick={() => {handleDeleteTraining(module),setIsLoading(true)}}
            />
            <Button
              name="Cancel"
              classname="bg-gray-300 text-black"
              titleClass="!text-[14px]"
              buttonClick={() => setModalOpen(false)}
            />
          </div>
        )}
      </div>
    </CommonModal>
  );
};
