import { SetMetadata } from "@nestjs/common";
import { Capability } from "../capabilities";

export const REQUIRED_CAPABILITY = "required_capability";

export const RequireCapability = (capability: Capability) =>
  SetMetadata(REQUIRED_CAPABILITY, capability);
