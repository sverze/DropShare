import { useContext, useMemo } from "react";
import { ConfigContext } from "../hooks/config.hook";
import configService from "../services/config.service";
import { ResolvedTheme } from "./theme.constants";
import { resolveTheme } from "./theme.util";

const useSiteTheme = (): ResolvedTheme => {
  const { configVariables } = useContext(ConfigContext);

  return useMemo(
    () => resolveTheme((key) => configService.get(key, configVariables)),
    [configVariables],
  );
};

export default useSiteTheme;
