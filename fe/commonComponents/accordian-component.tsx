import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Icon,
  Typography,
} from "@mui/material";
import type { NextPage } from "next";
import { ReactElement, ReactNode } from "react";

export type AccordianType = {
  className?: string;
  children: ReactElement;
  header: ReactNode;
  headerClass?: string;
  isOpen?: boolean;
  onClick?: () => void;
};

const AccordainComponent: NextPage<AccordianType> = ({
  className = "",
  children,
  header,
  headerClass = "",
  isOpen = false,
  onClick,
}) => {
  return (
    <div className="w-full flex justify-center">
      <Accordion
        className={`w-full max-w-[1114px] flex flex-col !bg-white shadow-sm rounded-md ${className}`}
        expanded={isOpen}
        onChange={onClick}
      >
        <AccordionSummary expandIcon={<Icon>expand_more</Icon>}>
          <div className={`flex w-full font-semibold text-[20px] ${headerClass}`}>
            {header}
          </div>
        </AccordionSummary>
        <AccordionDetails>
          <Typography component="div">{children}</Typography>
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

export default AccordainComponent;
