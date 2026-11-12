"use client";
import React from 'react'; 
import { useState, useRef, useEffect, useContext, useMemo } from "react";
import { Pause, Play, Maximize, ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";

import Layout from "../../../components/layout";
import Loader from "../../../commonComponents/loader";
import RestrictedPage from "../../../commonComponents/restricted";
import Button from "../../../commonComponents/button";
import { Progress } from "../../../commonComponents/progress";
import { MediaButton } from "../../../commonComponents/media-button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../commonComponents/card";

import useGetById from "../../../services/getById";
import useCreate from "../../../services/create";
import fetchPreSignedUrl from "../../../services/get-presigned-url";
import PptViewer from "../../../components/compliance/doc-viewer";

import {
  defaultTrainingFolder,
  generateCertificate,
  homePath,
  sidebarMenuItems,
  UserPath,
} from "../../../utils/constants";
import { fetchFilesFroms3Folder } from "../../../utils/uploadToS3";
import { RoleContext } from "../../../components/role-provider";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import { transformS3ModulesToStructured } from "../../../utils/complianceUtil";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";

import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import InputcheckboxComponent from "../../../commonComponents/input-checkbox-component";

export default function TrainingModulePage() {
  const router = useRouter();
  const { training_id } = router.query;
  const trainingId =
    typeof training_id === "string" ? training_id : training_id?.[0];

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoCompleted, setIsVideoCompleted] = useState(false);
  const [duration, setDuration] = useState(0);

  const [isCompleted, setIsCompleted] = useState(false);
  const [isPptCompleted, setIsPptCompleted] = useState(false);

  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [pptUrls, setPptUrls] = useState<Record<string, string>>({});

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [defaultTrainingFiles, setDefaultTrainingFiles] = useState<Record<string, any>>(
    {}
  );

  const [certificateLoader, setCertificateLoader] = useState(false);
  const [certificateDocUrl, setCertificateDocUrl] = useState<string | null>(null);

  const homeId = getHomeIdFromToken();
  const userId = getUserIdFromToken();

  const contextRole = useContext(RoleContext)?.role;
  const [roleAccess, setRoleAccess] = useState(false);

  const dispatch = useDispatch();
  const { mutate: createMutate } = useCreate();

  // prevents double-generation / double-download while async is running
  const hasIssuedCertificateRef = useRef(false);

  // ---------- Role access ----------
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;

    if (hasAccess(finalRole as Role, "COMPLIANCE", "VIEW")) {
      setRoleAccess(true);
    } else {
      setRoleAccess(false);
      router.push("/crm");
    }
  }, [contextRole, router]);

  // ---------- Fullscreen helpers ----------
  type FullscreenDoc = Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
  };
  type FullscreenEl = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };

  const requestFs = (el: HTMLElement) => {
    const w = el as FullscreenEl;
    if (el.requestFullscreen) return el.requestFullscreen();
    return w.webkitRequestFullscreen?.();
  };

  const exitFs = () => {
    const d = document as FullscreenDoc;
    if (document.exitFullscreen) return document.exitFullscreen();
    return d.webkitExitFullscreen?.();
  };

  const isInFullscreen = () => {
    const d = document as FullscreenDoc;
    return !!(document.fullscreenElement || d.webkitFullscreenElement);
  };

  const toggleFullscreen = async () => {
    const container = playerContainerRef.current;
    if (!container) return;
    if (isInFullscreen()) await exitFs();
    else await requestFs(container);
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(isInFullscreen());
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // ---------- Fetch user ----------
  const { data: userData, refetch: refetchUser } = useGetById({
    key: "userId",
    payload: { id: userId, path: UserPath,enabled:!!userId },
  });

  // keep certificate URL in sync from user data (so button works after refresh too)
  useEffect(() => {
    if (!userData || !trainingId) return;

    const url =
      userData?.documents?.find((d: any) => d.moduleId === trainingId)?.documentUrl ??
      null;

    if (url) setCertificateDocUrl(url);
  }, [userData, trainingId]);

  // if already completed, lock completion states + avoid auto-generation
  useEffect(() => {
    if (!trainingId) return;
    if (userData?.completedComplianceDocumentIds?.includes(trainingId)) {
      setIsVideoCompleted(true);
      setIsPptCompleted(true);
      setIsCompleted(true);
      hasIssuedCertificateRef.current = true;
    }
  }, [userData, trainingId]);

  // ---------- Fetch home (compliance modules) ----------
  const { data: HomeData } = useGetById({
    key: "compliance",
    payload: { id: homeId, path: homePath,enabled:!!homeId },
  });

  // ---------- Transform S3 modules ----------
  const transformS3Modules = (
    modules: Record<string, { video?: string; ppt?: string }>
  ) => {
    return Object.entries(modules).map(([moduleName, files]) =>
      transformS3ModulesToStructured(moduleName, files as any)
    );
  };

  // ---------- Fetch default training modules from S3 ----------
  useEffect(() => {
    const handleFetchDefaultTrainingModules = async () => {
      if (!trainingId) return;

      const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;
      try {
        const files = await fetchFilesFroms3Folder(bucketName, defaultTrainingFolder);
        setDefaultTrainingFiles(files);
      } catch (error) {
        console.error("Failed to fetch default training modules", error);
      }
    };

    handleFetchDefaultTrainingModules();
  }, [trainingId]);

  const TrainingData = useMemo(() => {
    if (!trainingId) return undefined;

    const dbTrainingData = HomeData?.home?.complianceTraining?.find(
      (module: any) => module.moduleId === trainingId
    );
    if (dbTrainingData) return dbTrainingData;

    const filesForThisModule = defaultTrainingFiles[trainingId];
    if (!filesForThisModule) return undefined;

    const transformed = transformS3Modules({
      [trainingId]: filesForThisModule,
    });

    return transformed[0];
  }, [HomeData, defaultTrainingFiles, trainingId]);

  // ---------- Filter documents (memoized) ----------
  const mp4Documents = useMemo(
    () =>
      TrainingData?.documents?.filter((doc: any) => doc.documentType === ".mp4") ??
      [],
    [TrainingData]
  );

  const pptDocuments = useMemo(
    () =>
      TrainingData?.documents?.filter(
        (doc: any) => doc.documentType === ".ppt" || doc.documentType === ".pptx"
      ) ?? [],
    [TrainingData]
  );

  // ---------- Completion logic ----------
  useEffect(() => {
    if (duration) {
      const watched = (currentTime / duration) * 100;
      if (watched > 99 && !isVideoCompleted) {
        setIsVideoCompleted(true);
      }
    }

    if (mp4Documents.length > 0 && pptDocuments.length > 0) {
      if (isVideoCompleted && isPptCompleted) setIsCompleted(true);
    } else if (mp4Documents.length > 0) {
      if (isVideoCompleted) setIsCompleted(true);
    } else if (pptDocuments.length > 0) {
      if (isPptCompleted) setIsCompleted(true);
    }
  }, [
    currentTime,
    duration,
    isPptCompleted,
    isVideoCompleted,
    mp4Documents.length,
    pptDocuments.length,
  ]);

  // ---------- Presigned URL fetch for media ----------
  useEffect(() => {
    const fetchAllPresignedUrls = async () => {
      if (!mp4Documents.length && !pptDocuments.length) return;

      const videoMap: Record<string, string> = {};
      const pptMap: Record<string, string> = {};

      for (const doc of mp4Documents) {
        const presignedUrl = await handleViewFile(doc.documentUrl);
        if (presignedUrl) videoMap[doc.documentId] = presignedUrl;
      }

      for (const doc of pptDocuments) {
        const presignedUrl = await handleViewFile(doc.documentUrl);
        if (presignedUrl) pptMap[doc.documentId] = presignedUrl;
      }

      setVideoUrls(videoMap);
      setPptUrls(pptMap);
    };

    fetchAllPresignedUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp4Documents, pptDocuments]);

  const handleViewFile = async (url: string) => {
      const enabled = !!url;
      if (!enabled) return;
    try {
      const srcUrl = await fetchPreSignedUrl(url);
      return srcUrl;
    } catch (error) {
      console.error("Failed to fetch pre-signed URL", error);
      throw error;
    }
  };

  // ---------- Certificate helpers (FIXED FLOW) ----------
  const createCertificateOnServer = () =>
    new Promise<any>((resolve, reject) => {
      createMutate(
        {
          userData: {
            userId,
            moduleName: TrainingData?.moduleName,
            moduleId: trainingId,
          },
          path: generateCertificate,
        },
        {
          onSuccess: (res: any) => resolve(res?.data),
          onError: (error: any) => reject(error),
        }
      );
    });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const ensureCertificateUrl = async (): Promise<string> => {
    // already have it
    if (certificateDocUrl) return certificateDocUrl;

    // generate on server (WAIT)
    const created = await createCertificateOnServer();

    // if API returns URL directly, use it
    const apiUrl = created?.documentUrl || created?.url || created?.s3Url;
    if (apiUrl) {
      setCertificateDocUrl(apiUrl);
      return apiUrl;
    }

    // otherwise refetch user until URL appears (a few retries helps when S3 + DB update is async)
    for (let attempt = 0; attempt < 5; attempt++) {
      const refetchRes: any = await refetchUser();
      const freshUser = refetchRes?.data ?? refetchRes;

      const url =
        freshUser?.documents?.find((d: any) => d.moduleId === trainingId)
          ?.documentUrl;

      if (url) {
        setCertificateDocUrl(url);
        return url;
      }

      await sleep(800);
    }

    throw new Error("Certificate generated, but document URL is not available yet.");
  };

  const downloadCertificate = async ({ download = false }: { download?: boolean } = {}) => {
    if (!trainingId || !TrainingData) return;

    setCertificateLoader(true);
    try {
      const url = await ensureCertificateUrl();

      if (download) {
        const filename = `${TrainingData?.moduleName ?? "Training"}_Certificate.docx`;
        await downloadFromPresignedUrl(url, filename);
      }
    } catch (error: any) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          error?.response?.data?.message ||
            error?.message ||
            "Error in creating Certificate"
        )
      );
      throw error;
    } finally {
      setCertificateLoader(false);
    }
  };

  // ---------- Auto-generate + auto-download once on FIRST completion ----------
  useEffect(() => {
    if (!isCompleted || !userData || !trainingId || !TrainingData) return;

    // already completed in DB -> do nothing
    if (userData.completedComplianceDocumentIds?.includes(trainingId)) return;

    // prevent duplicate calls while async is running
    if (hasIssuedCertificateRef.current) return;
    hasIssuedCertificateRef.current = true;

    (async () => {
      try {
        await downloadCertificate();
        // refresh user after successful generation/download (nice to keep UI in sync)
        await refetchUser();
      } catch (e) {
        // allow retry if it failed
        hasIssuedCertificateRef.current = false;
        console.error("Finalize completion failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, userData, trainingId, TrainingData]);

  // ---------- Video controls ----------
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) video.pause();
    else video.play();
    // onPlay/onPause handlers will sync isPlaying too, but keeping this is fine
    setIsPlaying((prev) => !prev);
  };

  const authorizedModules = useAuthorizedModules();
  const hasComplianceAccess = authorizedModules.includes(
    sidebarMenuItems.COMPLIANCE.toUpperCase()
  );

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };
  console.log(isPptCompleted,"isPptCompleted")
  return (
    <Layout>
      {roleAccess && hasComplianceAccess ? (
        <div className="font-poppins container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {TrainingData?.moduleName ?? "Training Module"}
              </h1>
              <p className="text-muted-foreground">
                {TrainingData?.moduleDescription}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Video Player */}
            {mp4Documents.length > 0 && (
              <div
                className={`flex ${
                  pptDocuments.length > 0 ? "col-span-2" : "col-span-3"
                } lg:col-span-3 space-y-4`}
              >
                <Card>
                  {mp4Documents.map((document: any) => {
                    const src = videoUrls[document.documentId];

                    if (!src) {
                      return (
                        <p key={document.documentId}>
                          <Loader
                            fullScreen={false}
                            spinner={false}
                            message="Loading Video..."
                          />
                        </p>
                      );
                    }

                    return (
                      <div key={document.documentId}>
                        <CardContent className="pt-[10px] px-0 bg-[#f4f3f3]">
                          <p>{document?.documentName}</p>

                          <div
                            ref={playerContainerRef}
                            className="relative aspect-video bg-black rounded-b-lg overflow-hidden"
                          >
                            <video
                              ref={videoRef}
                              className="w-full h-full"
                              src={src}
                              onPlay={() => setIsPlaying(true)}
                              onPause={() => setIsPlaying(false)}
                              onLoadedMetadata={(e) =>
                                setDuration(e.currentTarget.duration)
                              }
                              onTimeUpdate={(e) =>
                                setCurrentTime(e.currentTarget.currentTime)
                              }
                              playsInline
                              disablePictureInPicture
                              controls={false}
                            />

                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                              <div className="space-y-2">
                                <Progress
                                  value={duration ? (currentTime / duration) * 100 : 0}
                                  className="h-1"
                                />
                                <div className="flex items-center justify-between text-white">
                                  <div className="flex items-center gap-3">
                                    <MediaButton
                                      size="sm"
                                      variant="ghost"
                                      onClick={togglePlay}
                                      className="text-white bg-[gray] hover:bg-white/20"
                                    >
                                      {isPlaying ? (
                                        <Pause className="h-4 w-4" />
                                      ) : (
                                        <Play className="h-4 w-4" />
                                      )}
                                    </MediaButton>
                                    <span className="text-sm">
                                      {formatTime(currentTime)} / {formatTime(duration || 0)}
                                    </span>
                                  </div>

                                  <MediaButton
                                    size="sm"
                                    variant="ghost"
                                    className="text-white bg-[gray] hover:bg-white/20"
                                    onClick={toggleFullscreen}
                                    title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                                  >
                                    {isFullscreen ? (
                                      <ArrowLeft className="h-4 w-4 rotate-180" />
                                    ) : (
                                      <Maximize className="h-4 w-4" />
                                    )}
                                  </MediaButton>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    );
                  })}
                </Card>
              </div>
            )}

            {/* Content Sidebar (PPT) */}
            {pptDocuments.length > 0 && (
              <div
                className={`${
                  mp4Documents.length > 0 ? "col-span-1" : "col-span-3"
                } lg:col-span-3 space-y-4`}
              >
                <Card className="py-[20px]">
                  <CardHeader>
                    <CardTitle className="py-[10px]">Training Content</CardTitle>
                  </CardHeader>
                  {pptDocuments.map((document: any) => {
                    const src = pptUrls[document.documentId];
                    return (
                      <CardContent key={document.documentId}>
                        {/* Keep your existing viewer component */}
                        {/* @ts-ignore */}
                        <PptViewer pptUrl={src} />
                      </CardContent>
                    );
                  })}
                </Card>

                <div className="flex items-center justify-start">
                  <InputcheckboxComponent value={isPptCompleted} label={""} onChange={()=>setIsPptCompleted((prev) => !prev)} name={undefined} disabled={isCompleted}/>

                  <span>
                    I confirm that I have completed the full Assistly training Power Point for the{" "}
                    <strong>{TrainingData?.moduleName}</strong>, understand the material,
                    and am requesting a certificate based on this completion.
                  </span>
                </div>
              </div>
            )}

            {/* Certificate download */}
            <div>
              {isCompleted && (
                <Button
                  name={"Download Certificate"}
                  buttonClick={() => downloadCertificate({ download: true })}
                  icon={<Download className="h-6 w-6 mr-1 text-[white]" />}
                  iconStart={false}
                  isLoading={certificateLoader}
                  disabled={!isCompleted || certificateLoader}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <RestrictedPage />
        </div>
      )}
    </Layout>
  );
}

const isPresignedS3Url = (url?: string) => {
  if (!url) return false;
  // Works for AWS S3 presigned URLs (SigV4)
  return (
    url.startsWith("http") &&
    (url.includes("X-Amz-Signature=") ||
      url.includes("X-Amz-Algorithm=") ||
      url.includes("X-Amz-Credential="))
  );
};

// Download Certificate
// Download Certificate (SAFE)
const downloadFromPresignedUrl = async (s3Url?: string, _filename?: string) => {
  if (!s3Url) {
    throw new Error("Certificate is still being generated. Please try again in a few seconds.");
  }
  if (isPresignedS3Url(s3Url)) {
    window.open(s3Url, "_blank", "noopener,noreferrer");
    return;
  }
      const enabled = !!s3Url;
      if (!enabled) return;
  const preSignedUrl = await fetchPreSignedUrl(s3Url);

  if (!preSignedUrl) {
    throw new Error("Could not fetch a download link for the certificate.");
  }

  window.open(preSignedUrl, "_blank", "noopener,noreferrer");
};

