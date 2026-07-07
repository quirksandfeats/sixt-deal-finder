import { config } from "../config.js";
import { mockProvider } from "./mockProvider.js";
import { sixtProvider } from "./sixtProvider.js";

const providers = { mock: mockProvider, sixt: sixtProvider };

export function getProvider() {
  const p = providers[config.provider];
  if (!p) throw new Error(`Unknown PROVIDER "${config.provider}" (use "mock" or "sixt")`);
  return p;
}
