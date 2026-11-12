export const attachAddressAutocomplete = (
  inputName: string,
  setValue: (
    field: string,
    value: any,
    options?: { shouldValidate?: boolean }
  ) => void,
  fields: { street: string; city: string; state: string; zipCode: string }
) => {
  if (typeof window === "undefined") return;
  const googleObj = (window as any).google;
  if (!googleObj || !googleObj.maps || !googleObj.maps.places) return;

  const input = document.querySelector<HTMLInputElement>(
    `input[name="${inputName}"]`
  );
  if (!input) return;

  const autocomplete = new googleObj.maps.places.Autocomplete(input, {
    types: ["address"],
  });

  const listener = autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    const components =
      place && place.address_components ? place.address_components : [];
    if (!components || !components.length) return;

    const getComponent = (type: string) =>
      components.find((c: any) => c.types && c.types.indexOf(type) !== -1);

    const streetNumber = getComponent("street_number")?.long_name || "";
    const route = getComponent("route")?.long_name || "";
    const street = [streetNumber, route].filter(Boolean).join(" ");

    const city =
      getComponent("locality")?.long_name ||
      getComponent("sublocality")?.long_name ||
      "";

    const state = getComponent("administrative_area_level_1")?.short_name || "";

    const postal = getComponent("postal_code")?.long_name || "";
    const postalSuffix = getComponent("postal_code_suffix")?.long_name || "";
    const zip = postalSuffix ? `${postal}-${postalSuffix}` : postal;

    if (street) setValue(fields.street, street, { shouldValidate: true });
    if (city) setValue(fields.city, city, { shouldValidate: true });
    if (state) setValue(fields.state, state, { shouldValidate: true });
    if (zip) setValue(fields.zipCode, zip, { shouldValidate: true });
  });

  return () => {
    if (listener && typeof listener.remove === "function") {
      listener.remove();
    }
  };
};
