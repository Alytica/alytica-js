import { useContext } from "react";
import { AlyticaContext } from "../context/AlyticaContext";
import { Alytica } from "../../index";

export function useAlytica(): Alytica {
  const context = useContext(AlyticaContext);

  if (!context.alytica) {
    throw new Error(
      "useAlytica must be used within an AlyticaProvider. " +
        "Make sure you have wrapped your application with <AlyticaProvider>."
    );
  }

  return context.alytica;
}
