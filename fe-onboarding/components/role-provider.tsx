import { createContext, useEffect, useState } from "react";
import { Role } from "../utils/roles";
import { getUserRoleFromToken } from "../utils/auth";
type RoleContextType = {
  role: Role | null;
  setRole: (role: Role | null) => void;
};

export const RoleContext = createContext<RoleContextType | undefined>(
  undefined,
);

export const RoleProvider = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const storedRole = getUserRoleFromToken() as Role | undefined;
    if (storedRole) {
      setRole(storedRole);
    }
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
};
