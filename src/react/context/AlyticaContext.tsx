import { createContext } from "react";
import { Alytica } from "../../index";
interface AlyticaContextType {
  alytica: Alytica | null;
}

// Create context with default value
export const AlyticaContext = createContext<AlyticaContextType>({
  alytica: null,
});
