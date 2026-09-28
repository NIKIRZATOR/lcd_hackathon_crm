import { useEffect, useState, type CSSProperties } from 'react';

import { apiDownload } from '../../../api/client';

type OrganizationLogoProps = {
  organizationId: string;
  logoFileId: string | null;
  fallback: string;
  className: string;
  style?: CSSProperties;
};

const OrganizationLogo = ({ organizationId, logoFileId, fallback, className, style }: OrganizationLogoProps) => {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    if (!logoFileId) {
      setSrc(undefined);
      return undefined;
    }

    setSrc(undefined);
    let active = true;
    let objectUrl: string | undefined;

    apiDownload(`/api/organizations/${organizationId}/logo`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setSrc(undefined);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logoFileId, organizationId]);

  return src
    ? <img className={className} style={style} src={src} alt="" />
    : <span className={className} style={style}>{fallback}</span>;
};

export default OrganizationLogo;
