import { createContext, useContext, useState } from "react";

const UnsavedChangesContext = createContext();

export function UnsavedChangesProvider({ children }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}