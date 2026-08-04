import useConfig from "../hooks/config.hook";
import { logoVersion, versionedAsset } from "../utils/logo-asset.util";

const Logo = ({ height, width }: { height: number; width: number }) => {
  const config = useConfig();
  const src = versionedAsset("/img/logo.png", logoVersion(config.get));
  return <img src={src} alt="logo" height={height} width={width} />;
};
export default Logo;
