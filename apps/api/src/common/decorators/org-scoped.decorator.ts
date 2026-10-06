import { SetMetadata } from '@nestjs/common';

export const ORG_SCOPED_KEY = 'orgScoped';
/** Requires org membership via JWT orgId claim or X-Org-Id header */
export const OrgScoped = () => SetMetadata(ORG_SCOPED_KEY, true);
