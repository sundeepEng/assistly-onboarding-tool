import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
} from "date-fns";
import { getInitials } from "./getSignatureUtil";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
  handleShowWarningMessage,
} from "../redux/slices/exception-popover-slice";

const EmarDataLayer = (data: any, userMap: any, month: any, dispatch: any) => {
  const monthStart = startOfMonth(parseISO(month + "-01"));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const medPassMap = new Map();
  if (!data?.clinical?.medication) {
    dispatch(handleOpenPopover());
    dispatch(handleShowCloseOptions());
    dispatch(handleShowWarningMessage());
    dispatch(
      handleShowPopoverMessage(
        "No medication was administered during selected period"
      )
    );
    return null;
  } else {
    if (data?.clinical?.medPass) {
      for (const pass of data?.clinical?.medPass?.services) {
        const dt = parseISO(pass.providedAt);
        const dateStr = format(dt, "yyyy-MM-dd");
        const timeStr = pass?.timing.slice(0, 5);
        if (dt >= monthStart && dt <= monthEnd) {
          const key = `${pass.medicationId}_${dateStr}_${timeStr}`;
          medPassMap.set(key, pass);
        }
      }
      const result: any = {};
      result.name = data?.name;
      result.home = data?.home;
      result.biography = data?.biography || {};
      result.medical = data?.medical || {};
      result.emar = {};

      // OTC meds are one-time, so their medPass record may fall on a different
      // date than the selected month; keep a medicationId+time lookup.
      const otcPassMap = new Map();
      for (const pass of data?.clinical?.medPass?.services || []) {
        if (pass?.timing) {
          otcPassMap.set(
            `${pass.medicationId}_${pass.timing.slice(0, 5)}`,
            pass
          );
        }
      }
      console.log(otcPassMap,"otc pass map")
      for (const med of data?.clinical?.medication) {
        const medStart = med?.startdate ? parseISO(med.startdate) : null;
        if (!medStart) continue; // skip if no valid start date

        const medEnd = med?.enddate ? parseISO(med.enddate) : null;
        const effectiveMedEnd = medEnd ?? endOfDay(new Date());

        const isRegular = !med?.overTheCounter;

        if (isRegular) {
          const isActive =
            isWithinInterval(monthStart, {
              start: medStart,
              end: effectiveMedEnd,
            }) ||
            isWithinInterval(monthEnd, {
              start: medStart,
              end: effectiveMedEnd,
            }) ||
            isWithinInterval(medStart, { start: monthStart, end: monthEnd });

          if (!isActive) continue;
        } else {
          // OTC: one-time med, only show in the month it was prescribed
          if (medStart < monthStart || medStart > monthEnd) continue;
        }

        if (!result.emar[med.id]) result.emar[med.id] = { med: [] };
        // Sort timings in ascending order
        const sortedTimings = [...(med.timings || [])]
          .sort()
          .map((time) => time.slice(0, 5)); // Removes the last 3 characters ":00"

        if (isRegular) {
          // Build actual timing entries
          for (const time of sortedTimings) {
            const timingEntry = { hour: time, days: [] };
            for (const date of daysInMonth) {
              const dateStr = format(date, "yyyy-MM-dd");
              const key = `${med.id}_${dateStr}_${time}`;
              const pass = medPassMap.get(key);
              const sign = userMap[pass?.providedBy];
              timingEntry.days.push({
                day: Number(format(date, "d")),
                passOrRefuse: pass?.passOrRefuse || "",
                initials: getInitials(sign?.name) || "",
              });
            }
            result.emar[med.id].med.push(timingEntry);
            result.emar[med.id].dosage = med.dosage || "";
          }

          // Add filler rows if needed to make at least 4 rows
          while (result.emar[med.id].med.length < 4) {
            const fillerEntry = { hour: "", days: [] };
            for (const date of daysInMonth) {
              fillerEntry.days.push({
                day: Number(format(date, "d")),
                passOrRefuse: "",
                initials: "",
              });
            }
            result.emar[med.id].med.push(fillerEntry);
          }
        } else {
          // OTC: one-time med, show the pass/refuse only on its startdate
          for (const time of sortedTimings) {
            const timingEntry = { hour: time, days: [] };
            const otcPass = otcPassMap.get(`${med.id}_${time}`);
            const sign = userMap[otcPass?.providedBy];
            for (const date of daysInMonth) {
              const dateStr = format(date, "yyyy-MM-dd");
              const isMatch = dateStr === med.startdate;
              timingEntry.days.push({
                day: Number(format(date, "d")),
                passOrRefuse: isMatch ? otcPass?.passOrRefuse || "" : "",
                initials: isMatch ? getInitials(sign?.name) || "" : "",
              });
            }
            result.emar[med.id].med.push(timingEntry);
            result.emar[med.id].dosage = med.dosage || "";
          }
        }
        result.emar[med.id].name = med.name;
      }

      if (Object.keys(result.emar).length === 0) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowWarningMessage());
        dispatch(
          handleShowPopoverMessage(
            "No medication was administered during selected period"
          )
        );
        return null;
      }

      return result;
    } else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowWarningMessage());
      dispatch(
        handleShowPopoverMessage(
          "No medication was administered during selected period"
        )
      );
      return;
    }
  }
};

export default EmarDataLayer;
