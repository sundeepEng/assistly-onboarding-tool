import React from "react";
import {
  ESIGN_ENVELOPE_STATUS_COMPLETED,
  ESIGN_ENVELOPE_STATUS_DECLINED,
  ESIGN_ENVELOPE_STATUS_ERROR,
  ESIGN_ENVELOPE_STATUS_EXPIRED,
  ESIGN_ENVELOPE_STATUS_PENDING,
} from "./constants";

export const ContractStatus = (envelopeStatus) => {
  let docusignStatus: string;
  let colorStatus: string;
  switch (envelopeStatus) {
    case ESIGN_ENVELOPE_STATUS_COMPLETED:
      docusignStatus = "The contract has been successfully signed";
      colorStatus = "#514CEB";
      break;
    case ESIGN_ENVELOPE_STATUS_DECLINED:
      docusignStatus = "The e-sign request has been declined";
      colorStatus = "#DC3545";
      break;
    case ESIGN_ENVELOPE_STATUS_PENDING:
      docusignStatus = "The contract was sent and is awaiting signature";
      colorStatus = "#ffa503";
      break;
    case ESIGN_ENVELOPE_STATUS_EXPIRED:
      docusignStatus = "The e-sign request has expired";
      colorStatus = "#DC3545";
      break;
    case ESIGN_ENVELOPE_STATUS_ERROR:
      docusignStatus = "An error occurred while processing the document";
      colorStatus = "#DC3545";
      break;
    default:
      docusignStatus = "The e-sign request is pending and not yet initiated";
      colorStatus = "gray";
  }
  return { docusignStatus, colorStatus };
};
