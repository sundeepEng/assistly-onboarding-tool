import React, { useEffect, useState } from "react";
import InputFieldComponent from "../../commonComponents/input-field-component";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { uploadToS3 } from "../../utils/uploadToS3";
import { Save } from "lucide-react";
import _ from "lodash";
import useUpdate from "../../services/update";
import { useAppDispatch } from "../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import { omit } from "../../utils/dateUtils";
import { docusealSlugURL, USER_PATH_OMIT_FIELDS, UserPath } from "../../utils/constants";
import Button from "../../commonComponents/button";
import { getUserIdFromToken, getHomeIdFromToken } from "../../utils/auth";
import Loader from "../../commonComponents/loader";
import useCreate from "../../services/create";

export async function extractPlaceholdersFromDocx(
  docUrl: string
): Promise<string[]> {
  try {
    const res = await fetch(docUrl);

    if (!res.ok) {
      console.error(
        `Failed to fetch document: ${res.status} ${res.statusText}`
      );
      return [];
    }

    const arrayBuffer = await res.arrayBuffer();

    if (arrayBuffer.byteLength < 100) {
      console.warn("File too small, not a valid DOCX");
      return [];
    }

    let zip: PizZip;
    try {
      zip = new PizZip(arrayBuffer);
    } catch (err) {
      console.error("PizZip error: not a valid DOCX file", err);
      return [];
    }

    const placeholderSet = new Set<string>();

    const extractFromXml = (xml: string) => {
      const cleaned = xml
        .replace(/<\/w:t><w:t>/g, "") // join split runs
        .replace(/<[^>]+>/g, ""); // strip XML tags

      // Match [[field_name]] (letters, numbers, underscores, dots, dashes)
      const matches = cleaned.match(/\[\[\s*([\w.-]+)\s*\]\]/g) || [];

      for (const m of matches) {
        const inner = m.replace(/^\[\[\s*|\s*\]\]$/g, ""); // remove [[ ]]
        placeholderSet.add(inner.trim());
      }
    };

    // Main body
    const mainDocXml = zip.file("word/document.xml")?.asText();
    if (mainDocXml) extractFromXml(mainDocXml);

    // Headers/Footers
    Object.keys(zip.files).forEach((fileName) => {
      if (/word\/(header|footer)\d+\.xml/.test(fileName)) {
        const xml = zip.file(fileName)?.asText();
        if (xml) extractFromXml(xml);
      }
    });

    return Array.from(placeholderSet);
  } catch (err) {
    console.error("Unexpected error extracting placeholders:", err);
    return [];
  }
}

export default function DocumentDynamicForm({
  url,
  leadData,
  selectedDocumentData,
  setIsModalOpen,
  firstPCHO = {},   // optional object with default
}: {
  url: string;
  leadData: any;
  selectedDocumentData: any;
  setIsModalOpen: (val: boolean) => void;
  firstPCHO?:any;   // optional object type
}) {
  const [fields, setFields] = useState<string[]>([]);
  const [formData, setFormData] = useState<{ [key: string]: string }>({});
  const [docLoaded, setDocLoaded] = useState(false);
  const { mutate } = useUpdate();
  const dispatch = useAppDispatch();
  const { mutate: createMutate } = useCreate();

  const loggedInUserId = getUserIdFromToken();
  const homeId = getHomeIdFromToken();

  useEffect(() => {
    const fetchDoc = async () => {
      const placeholders = await extractPlaceholdersFromDocx(url);
      setFields(placeholders);

      // Initialize formData with empty values
      const initialData = placeholders.reduce((acc, curr) => {
        acc[curr] = "";
        return acc;
      }, {} as { [key: string]: string });

      setFormData(initialData);
      setDocLoaded(true);
    };

    fetchDoc();
  }, [url]);

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDocumentData?.documentTemplateId && leadData?.email === undefined || leadData?.email === null) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Lead email is missing.")
      );
      setIsModalOpen(false);
      return;
    }
    try {
      const modifiedDocument: any = await generateFilledDocx(url, formData);
      const bucketUploadPath = `${homeId}/${leadData?.userId}/${selectedDocumentData?.documentName}${selectedDocumentData?.documentType}`;
      const bucketName =
        process.env.NEXT_PUBLIC_AWS_MODIFIED_CONTRACTS_BUCKET_NAME;
      let uploadedFileUrl;
      if (modifiedDocument) {
        uploadedFileUrl = await uploadToS3(
          modifiedDocument,
          bucketUploadPath,
          bucketName
        );
      }

      if (uploadedFileUrl) {
        const updatedDocument = {
          documentId: selectedDocumentData.documentId, // keep the same ID
          documentType: selectedDocumentData.documentType, // retain type
          documentName: selectedDocumentData.documentName, // retain name
          documentUrl: uploadedFileUrl, // new uploaded URL
          createdByUserId: loggedInUserId, // the current user
          createdAt: new Date().toISOString(), // current timestamp
          isRequiredDocument: selectedDocumentData?.required || false, // retain or default
          documentCategory:
            selectedDocumentData?.documentCategory || "onboarding", // retain or default
        };

        const existingDocuments = _.get(leadData, "documents", []);
        const updatedDocuments = existingDocuments.map((doc: any) =>
          doc.documentId === updatedDocument.documentId ? updatedDocument : doc
        );

        const userDataToUpdate = {
          ...leadData,
          documents: updatedDocuments,
        };

        const cleanedData: any = omit(userDataToUpdate, USER_PATH_OMIT_FIELDS);

        const payload = { data: cleanedData, path: UserPath };

        mutate(payload, {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(
              handleShowPopoverMessage("Document updated successfully!")
            );
            setIsModalOpen(false);
          },
          onError: (error: any) => {
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(
              handleShowPopoverMessage(
                "Failed to update document. Please try again."
              )
            );
            setIsModalOpen(false);
          },
        });

        // Create Docuseal slug URL with updated document info
        if (selectedDocumentData?.documentTemplateId) {
          const leadExternalId = `${leadData?.userId}-${selectedDocumentData?.documentName}`;
          const PCHOExternalId = `${firstPCHO?.userId}-${leadData?.userId}-${selectedDocumentData?.documentName}`;
          const dataForSlugURLs = {
            templateId: Number(selectedDocumentData?.documentTemplateId), // your Docuseal template id 2180916.  2243845- this with values
            submitters: [
              {
                role: "Resident",
                email: leadData?.email,
                values: formData,
                external_id: leadExternalId,
              },
              {
                role: "PCHO",
                email: firstPCHO?.email,
                external_id: PCHOExternalId,
              },
            ],
          };
          const payloadDataForSlugURLs = {
            userData: dataForSlugURLs,
            path: docusealSlugURL, // "v1/slug-urls"
          };
          createMutate(payloadDataForSlugURLs, {
            onSuccess: (res: any) => {
            },
            onError: (error: any) => {
              console.error("Error creating Docuseal slug URL:", error);
            },
          });
        }
        // Create Docuseal slug URL with updated document info ends here
      }
    } catch (err) {
      console.error("Error generating filled doc:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {fields.map((field, index) => {

        const labelText = _.startCase(_.toLower(field));

        return (
          <div key={index} className="mb-4">
            <InputFieldComponent
              label={labelText}
              placeholder={
                field === "Inventory_list"
                  ? "Example: Shirts - 5, Pants - 6, Towels - 2"
                  : `Enter ${labelText}`
              }
              type="text"
              name={field}
              value={formData[field] || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange(field, e.target.value)
              }
            />
          </div>
        );
      })}

      {!docLoaded ? (
        <div>
          <Loader
            spinner={false}
            message="Loading documents and extracting fields..."
            fullScreen={false}
          />
        </div>
      ) : fields.length > 0 ? (
        <div className="flex justify-between gap-2 mt-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 border bg-[#F7FAFC] border-gray-300 text-gray-700 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
          >
            Cancel
          </div>
          <Button
            name="Save Changes"
          />
        </div>
      ) : (
        <div className="text-red-500 mt-2 font-poppins px-4 text-center">
          All fields have been filled. Your document is ready!
        </div>
      )}
    </form>
  );
}

async function fetchDocTemplate(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return res.arrayBuffer();
}

export async function generateFilledDocx(
  docUrl: string,
  data: Record<string, string>
) {
  try {
    const content = await fetchDocTemplate(docUrl);
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // 🔑 Use [[ ]] for templating so {{ }} (Docuseal) is ignored
      delimiters: { start: "[[", end: "]]" },
      // Keep unknown tags as [[tag]] so your "put placeholder back" behavior still works
      nullGetter: (part) => `[[${part.tag}]]`,
    });

    // Same semantics as before:
    // if user didn't type anything, put the same variable back (but now [[key]])
    const preparedData: Record<string, string> = Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        const trimmed = value?.trim() ?? "";
        return [key, trimmed !== "" ? trimmed : `[[${key}]]`];
      })
    );

    doc.setData(preparedData);

    try {
      doc.render();
    } catch (error: any) {
      console.error("Template rendering error", error);
      throw error;
    }

    const modifiedDocument = doc.getZip().generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    return modifiedDocument;
  } catch (err) {
    console.error("Error generating DOCX", err);
  }
}


// Util: Extract placeholders from DOCX
// export async function extractPlaceholdersFromDocx(
//   docUrl: string
// ): Promise<string[]> {
//   const res = await fetch(docUrl);
//   const arrayBuffer = await res.arrayBuffer();
//   const zip = new PizZip(arrayBuffer);

//   const xmlContent = zip.file("word/document.xml")?.asText() || "";

//   const cleaned = xmlContent
//     .replace(/<\/w:t><w:t>/g, "") // Join split text
//     .replace(/<[^>]+>/g, ""); // Strip XML tags

//   const matches = cleaned.match(/{\s*[\w.-]+\s*}/g) || [];
//   const fields = Array.from(
//   new Set(matches.map((m) => m.replace(/[{}]/g, "").trim()))
// );
//   return fields;
// }
