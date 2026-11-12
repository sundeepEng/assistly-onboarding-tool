import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const STORAGE_KEY = "extractedDocumentUrls";

const getPersistedUrls = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const persistUrls = (urls: string[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
  } catch {}
};

export interface ExtractedMedication {
  id: string;
  name: string;
  dosage: string;
  directions: string;
  startdate: string;
  enddate: string;
  timings: string[];
  additionalComments: string;
}

interface MedicationExtractionState {
  extractedMedications: ExtractedMedication[];
  isLoading: boolean;
  error: string | null;
  seniorId: string | null;
  sourceDocumentUrl: string | null;
  extractedDocumentUrls: string[];
}

const initialState: MedicationExtractionState = {
  extractedMedications: [],
  isLoading: false,
  error: null,
  seniorId: null,
  sourceDocumentUrl: null,
  extractedDocumentUrls: getPersistedUrls(),
};

const medicationExtractionSlice = createSlice({
  name: "medicationExtraction",
  initialState,
  reducers: {
    setExtractionLoading: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    setExtractedMedications: (
      state,
      action: PayloadAction<{
        medications: ExtractedMedication[];
        seniorId: string;
        sourceDocumentUrl?: string;
      }>
    ) => {
      state.extractedMedications = action.payload.medications;
      state.seniorId = action.payload.seniorId;
      state.sourceDocumentUrl = action.payload.sourceDocumentUrl || null;
      state.isLoading = false;
      state.error = null;
    },
    setExtractionError: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    updateExtractedMedication: (
      state,
      action: PayloadAction<{ index: number; medication: ExtractedMedication }>
    ) => {
      state.extractedMedications[action.payload.index] =
        action.payload.medication;
    },
    removeExtractedMedication: (state, action: PayloadAction<number>) => {
      state.extractedMedications.splice(action.payload, 1);
    },
    markDocumentExtracted: (state) => {
      if (state.sourceDocumentUrl) {
        state.extractedDocumentUrls.push(state.sourceDocumentUrl);
        persistUrls(state.extractedDocumentUrls);
      }
      state.extractedMedications = [];
      state.isLoading = false;
      state.error = null;
      state.seniorId = null;
      state.sourceDocumentUrl = null;
    },
    clearExtractedMedications: (state) => {
      state.extractedMedications = [];
      state.isLoading = false;
      state.error = null;
      state.seniorId = null;
      state.sourceDocumentUrl = null;
    },
  },
});

export const {
  setExtractionLoading,
  setExtractedMedications,
  setExtractionError,
  updateExtractedMedication,
  removeExtractedMedication,
  markDocumentExtracted,
  clearExtractedMedications,
} = medicationExtractionSlice.actions;

export default medicationExtractionSlice.reducer;
