import React, { ReactNode, JSX } from "react";
import { Alytica } from "../../index";
import { WebTrackingClientConfig } from "../../types";
import { AlyticaContext } from "./AlyticaContext";
interface AlyticaProviderProps {
  options: WebTrackingClientConfig;
  children: ReactNode;
}

/**
 * Provider component that creates and provides an Alytica instance
 */
export function AlyticaProvider({
  options,
  children,
}: AlyticaProviderProps): JSX.Element {
  // Create the Alytica instance with the provided options
  const alyticaInstance = React.useMemo(() => {
    return new Alytica(options);
  }, [options]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => {
    return { alytica: alyticaInstance };
  }, [alyticaInstance]);

  return (
    <AlyticaContext.Provider value={contextValue}>
      {children}
    </AlyticaContext.Provider>
  );
}
