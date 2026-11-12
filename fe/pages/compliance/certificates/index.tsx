import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../../../components/layout";
import useGetById from "../../../services/getById";
import {
  UserPath,
  DocumentType,
  USER_PATH_OMIT_FIELDS,
  sidebarMenuItems,
} from "../../../utils/constants";
import fetchPreSignedUrl from "../../../services/get-presigned-url";
import { DocumentCard } from "../../../components/compliance/doc-viewer";
import { useRouter } from "next/router";
import { RoleContext } from "../../../components/role-provider";
import { Role } from "../../../utils/roles";
import { hasAccess } from "../../../utils/roleAccess";
import Loader from "../../../commonComponents/loader";
import { getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import RestrictedPage from "../../../commonComponents/restricted";
import { UUIDTypes } from "uuid";
import { omit } from "lodash";
import useUpdate from "../../../services/update";
import { useAuthorizedModules } from "../../../utils/useAuthorizedModules";

// remove duplicate certificates
type DocumentItem = {
  documentExpiryDate: string;
  documentId: UUIDTypes;
  documentCategory: "onboarding" | "certificate" | "other";
  documentName: string;
  documentUrl: string;
  documentType: DocumentType;
  isRequiredDocument?: boolean;
  createdByUserId: UUIDTypes;
  createdAt: Date;
};

function dedupeByDocumentUrl(docs: DocumentItem[]): DocumentItem[] {
  const map = new Map<string, DocumentItem>();

  for (const doc of docs) {
    if (!map.has(doc.documentUrl)) {
      map.set(doc.documentUrl, doc);
    }
  }

  return Array.from(map.values());
}
// TODO: remove duplicates

const Index = () => {
  const userId = getUserIdFromToken();
  const [loader, setLoader] = useState(false);
  const { data: userData, isSuccess } = useGetById({
    key: "userId",
    payload: { id: userId, path: UserPath,enabled:!!userId },
  });
  const router = useRouter();
  const { mutate } = useUpdate();
  const contextRole = useContext(RoleContext)?.role;
  const [roleAccess, setRoleAccess] = useState(false);
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

  // presigned URL mapping { documentId: presignedUrl }
  const [certificateMap, setCertificateMap] = useState<Record<string, string>>(
    {}
  );

  // 1. Raw certificates from userData
  const Certificates: DocumentItem[] = useMemo(() => {
    return (
      userData?.documents?.filter(
        (doc: any) => doc.documentCategory === "certificate"
      ) || []
    );
  }, [userData?.documents]);

// TODO: remove duplicates
  const otherDocuments: DocumentItem[] = useMemo(() => {
    return (
      userData?.documents?.filter(
        (doc: any) => doc.documentCategory !== "certificate"
      ) || []
    );
  }, [userData?.documents]);

  // 2️. Deduped by documentUrl (this is your unique list)
  const dedupedCertificates = useMemo(
    () => dedupeByDocumentUrl(Certificates),
    [Certificates]
  );

  // 3️⃣ Run presign fetch only once per page load
  const hasFetchedPresigned = useRef(false);
  // Track if user data has already been updated to prevent infinite loop
  const hasUpdatedUser = useRef(false);
// TODO: remove duplicates

  useEffect(() => {

    // if (!Certificates || Certificates.length === 0) return;

    // // ✅ Avoid refetch if already have URLs
    // if (Object.keys(certificateMap).length === Certificates.length) return;


// TODO: remove duplicates
    if (!dedupedCertificates.length) return;
    if (hasFetchedPresigned.current) return;
    
    // Update user data only once to remove duplicate certificates and prevent infinite loop
    if (!hasUpdatedUser.current) {
      const dedupUserData = {
        ...userData,
        documents: [...dedupedCertificates, ...otherDocuments],
      };
      const updateUser = async () => {
        const sanitized = omit(dedupUserData, USER_PATH_OMIT_FIELDS);

        await mutate({ data: sanitized, path: UserPath });
      };
      updateUser();
      hasUpdatedUser.current = true;
    }
// TODO: remove duplicates

    const fetchAllPresignedUrls = async () => {
      try {
        setLoader(true);

        const results = await Promise.all(
          // TODO: remove duplicates, make vraible Certificates
          dedupedCertificates.map(async (certificate) => {
            const presignedUrl = await handleViewFile(certificate.documentUrl);
            return {
              id: certificate.documentId,
              url: presignedUrl || "",
            };
          })
        );

        const map: Record<string, string> = {};
        results.forEach((item) => {
          if (item.url) {
            map[String(item.id)] = item.url;
          }
        });

        setCertificateMap(map);
      } catch (error) {
        console.error("Error fetching presigned URLs", error);
      } finally {
        setLoader(false);
        hasFetchedPresigned.current = true; // ✅ only once
      }
    };

    fetchAllPresignedUrls();
    // TODO: remove duplicates, make vraible Certificates
  }, [dedupedCertificates]);

  const handleViewFile = async (url: string) => {
      const enabled = !!url;
      if (!enabled) return;
    try {
      return await fetchPreSignedUrl(url);
    } catch (error) {
      console.error("Presign error:", error);
      return null;
    }
  };

  const authorizedModules = useAuthorizedModules();
  const hasComplianceAccess = authorizedModules.includes(
    sidebarMenuItems.COMPLIANCE.toUpperCase(),
  );

  return (
    <Layout>
      {roleAccess && hasComplianceAccess ? (
        <div className="flex flex-wrap gap-4 font-jakarta">
          {loader ? (
            <Loader fullScreen={false} />
          ) : isSuccess && dedupedCertificates.length === 0 ? (
            <div className="flex justify-center mb-4 w-full ">
              <p className="text-[gray] font-semibold text-[24px]">
                Get certificates by completing Training.
              </p>
            </div>
          ) : (
            dedupedCertificates.map((certificate) => {
              const url = certificateMap[String(certificate.documentId)];
              return (
                <div
                  key={String(certificate.documentId)}
                  className="mb-4 w-[500px] flex-wrap"
                >
                  <DocumentCard 
                    s3Url={url} 
                    title={certificate.documentName}
                    documentExpiryDate={certificate.documentExpiryDate}
                  />
                </div>
              );
            })
          )}
        </div>
      ) : (
        <RestrictedPage />
      )}
    </Layout>
  );
};

export default Index;
