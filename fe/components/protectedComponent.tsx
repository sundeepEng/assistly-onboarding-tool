import { hasAccess } from "../utils/roleAccess";
import { Access, Role } from "../utils/roles";

type Props = {
  role: Role;
  feature: string | string[];
  access: Access |Access[];
  children: React.ReactNode;
};

export const ProtectedComponent = ({ role, feature, access, children }: Props) => {
  const features = Array.isArray(feature) ? feature : [feature];
  const accesses = Array.isArray(access) ? access : [access];
  const orderedAccesses = accesses.includes("EDIT")
    ? ["EDIT", "VIEW"]
    : accesses;

  const isAllowed = features.some((feat) =>
    orderedAccesses.some((a) => hasAccess(role, feat, a as Access))
  );

  if (!isAllowed) return null;

  return <div>{children}</div>;
};
